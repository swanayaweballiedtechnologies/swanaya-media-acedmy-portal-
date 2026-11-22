/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { SwanayaDatabase } from '../db/mockDb';
import { sendGmailMessage } from './gmailService';

export interface GoogleMeetMeeting {
  id: string;
  calendarEventId?: string;
  title: string;
  description?: string;
  courseId: string;
  courseName?: string;
  batchId?: string;
  batchName?: string;
  instructorId?: string;
  instructorName?: string;
  instructorEmail?: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  meetLink: string;
  organizerEmail: string;
  organizerName: string;
  attendeeEmails?: string[];
  status: 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export const calendarService = {
  subscribeMeetings(
    onData: (meetings: GoogleMeetMeeting[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const mergeAndEmit = (cloudList: GoogleMeetMeeting[]) => {
      const localList = SwanayaDatabase.get<GoogleMeetMeeting[]>('google_meet_meetings') || [];
      const map = new Map<string, GoogleMeetMeeting>();
      localList.forEach((m) => m?.id && map.set(m.id, m));
      cloudList.forEach((m) => m?.id && map.set(m.id, m));

      const sorted = Array.from(map.values())
        .filter((m) => m.status !== 'CANCELLED')
        .sort((a, b) => String(b.startTime).localeCompare(String(a.startTime)));
      onData(sorted);
    };

    mergeAndEmit([]);

    const handleStorage = () => mergeAndEmit([]);
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
      window.addEventListener('sma-autosave', handleStorage);
    }

    let unsubFirestore = () => {};
    if (auth.currentUser) {
      try {
        const q = query(collection(db, 'google_meet_meetings'));
        unsubFirestore = onSnapshot(
          q,
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as GoogleMeetMeeting));
            mergeAndEmit(list);
          },
          (err) => {
            console.warn('Google meet meetings Firestore listener notice:', err?.message);
            onError?.(err instanceof Error ? err : new Error(String(err)));
            mergeAndEmit([]);
          }
        );
      } catch (err: any) {
        console.warn('Unable to attach Google meet meetings listener:', err?.message);
      }
    }

    return () => {
      unsubFirestore();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('sma-autosave', handleStorage);
      }
    };
  },

  async scheduleGoogleMeetEvent(params: {
    title: string;
    description?: string;
    courseId: string;
    courseName?: string;
    batchId?: string;
    batchName?: string;
    instructorId?: string;
    instructorName?: string;
    instructorEmail?: string;
    startTime: string; // YYYY-MM-DDTHH:mm
    endTime: string; // YYYY-MM-DDTHH:mm
    accessToken: string;
    organizerEmail: string;
    organizerName: string;
    attendeeEmails?: string[];
    sendEmailInvites?: boolean;
  }): Promise<{ meeting: GoogleMeetMeeting; calendarEventId: string }> {
    const {
      title,
      description = '',
      courseId,
      courseName = '',
      batchId = '',
      batchName = '',
      instructorId = '',
      instructorName = '',
      instructorEmail = '',
      startTime,
      endTime,
      accessToken,
      organizerEmail,
      organizerName,
      attendeeEmails = [],
      sendEmailInvites = true,
    } = params;

    const startIso = new Date(startTime).toISOString();
    const endIso = new Date(endTime).toISOString();
    const requestId = `meet-req-${Date.now()}`;

    // Combine attendee emails including instructor email if provided
    const allAttendees = Array.from(new Set([
      ...attendeeEmails,
      ...(instructorEmail && instructorEmail.includes('@') ? [instructorEmail] : [])
    ]));

    // Call official Google Calendar API with conferenceData for Google Meet
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: title,
        description: `${description}\n\nSwanaya Media Academy Academic Session · Course: ${courseName || courseId}${instructorName ? ` · Faculty: ${instructorName}` : ''}`,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
        attendees: allAttendees.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Google Calendar API error HTTP ${response.status}: Failed to create Google Meet event.`);
    }

    const eventData = await response.json();
    const calendarEventId = eventData.id;
    const meetLink =
      eventData.hangoutLink ||
      eventData.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri ||
      eventData.htmlLink;

    if (!meetLink) {
      throw new Error('Google Calendar event created successfully, but Google Meet conference link was not returned.');
    }

    const now = new Date().toISOString();
    const meetingId = `meet-${Date.now()}`;

    const meeting: GoogleMeetMeeting = {
      id: meetingId,
      calendarEventId,
      title: title.trim(),
      description: description.trim(),
      courseId,
      courseName,
      batchId,
      batchName,
      instructorId,
      instructorName,
      instructorEmail,
      startTime: startIso,
      endTime: endIso,
      meetLink,
      organizerEmail,
      organizerName,
      attendeeEmails: allAttendees,
      status: 'SCHEDULED',
      createdAt: now,
      updatedAt: now,
    };

    // Save to local and Firestore
    const localMeetings = SwanayaDatabase.get<GoogleMeetMeeting[]>('google_meet_meetings') || [];
    SwanayaDatabase.set('google_meet_meetings', [meeting, ...localMeetings]);

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'google_meet_meetings', meetingId), meeting);
      } catch (err: any) {
        console.warn('Firestore meeting save notice:', err?.message);
      }
    }

    // Send email invitations via Gmail API if requested & attendees provided
    if (sendEmailInvites && attendeeEmails.length > 0) {
      const emailBody = `
        <h3>Swanaya Media Academy - Official Google Meet Class Invitation</h3>
        <p><strong>Session:</strong> ${title}</p>
        <p><strong>Course:</strong> ${courseName || courseId}</p>
        <p><strong>Batch:</strong> ${batchName || 'Enrolled Cohort'}</p>
        <p><strong>Scheduled Start:</strong> ${new Date(startIso).toLocaleString()}</p>
        <p><strong>Scheduled End:</strong> ${new Date(endIso).toLocaleString()}</p>
        <p><strong>Organizer:</strong> ${organizerName} (${organizerEmail})</p>
        <p style="margin-top: 20px;">
          <a href="${meetLink}" style="background-color: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">
            Join Google Meet Room ↗
          </a>
        </p>
        <p style="margin-top: 15px; color: #64748b; font-size: 12px;">Swanaya Media Academy Portal · Automated Academic Notice</p>
      `;

      for (const email of attendeeEmails) {
        try {
          await sendGmailMessage({
            to: email,
            subject: `[SMA Live Class] ${title} - Google Meet Invitation`,
            body: emailBody,
            accessToken,
          });
        } catch (emailErr) {
          console.warn(`Failed to dispatch invite email to ${email}:`, emailErr);
        }
      }
    }

    SwanayaDatabase.log(
      organizerEmail,
      organizerName,
      'GOOGLE_MEET_SCHEDULED',
      `Scheduled Google Meet: ${title} (${meetLink})`
    );

    return { meeting, calendarEventId };
  },

  async updateGoogleMeetEvent(params: {
    meeting: GoogleMeetMeeting;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    accessToken: string;
    organizerEmail: string;
    organizerName: string;
  }): Promise<GoogleMeetMeeting> {
    const { meeting, title, description = '', startTime, endTime, accessToken, organizerEmail, organizerName } = params;
    const startIso = new Date(startTime).toISOString();
    const endIso = new Date(endTime).toISOString();

    if (meeting.calendarEventId) {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.calendarEventId}?conferenceDataVersion=1`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: title,
          description,
          start: { dateTime: startIso },
          end: { dateTime: endIso },
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'Failed to update Google Calendar event.');
      }
    }

    const updated: GoogleMeetMeeting = {
      ...meeting,
      title: title.trim(),
      description: description.trim(),
      startTime: startIso,
      endTime: endIso,
      status: 'RESCHEDULED',
      updatedAt: new Date().toISOString(),
    };

    const localMeetings = SwanayaDatabase.get<GoogleMeetMeeting[]>('google_meet_meetings') || [];
    SwanayaDatabase.set('google_meet_meetings', localMeetings.map((m) => (m.id === meeting.id ? updated : m)));

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'google_meet_meetings', meeting.id), updated);
      } catch (err) {
        console.warn('Firestore meeting update notice:', err);
      }
    }

    SwanayaDatabase.log(organizerEmail, organizerName, 'GOOGLE_MEET_UPDATED', `Rescheduled Google Meet: ${title}`);
    return updated;
  },

  async cancelGoogleMeetEvent(meeting: GoogleMeetMeeting, accessToken: string, organizerEmail: string, organizerName: string): Promise<void> {
    if (meeting.calendarEventId && accessToken) {
      try {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.calendarEventId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
      } catch (err) {
        console.warn('Google calendar event delete warning:', err);
      }
    }

    const cancelled: GoogleMeetMeeting = {
      ...meeting,
      status: 'CANCELLED',
      updatedAt: new Date().toISOString(),
    };

    const localMeetings = SwanayaDatabase.get<GoogleMeetMeeting[]>('google_meet_meetings') || [];
    SwanayaDatabase.set('google_meet_meetings', localMeetings.filter((m) => m.id !== meeting.id));

    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'google_meet_meetings', meeting.id));
      } catch (err) {
        console.warn('Firestore meeting delete warning:', err);
      }
    }

    SwanayaDatabase.log(organizerEmail, organizerName, 'GOOGLE_MEET_CANCELLED', `Cancelled Google Meet: ${meeting.title}`);
  }
};
