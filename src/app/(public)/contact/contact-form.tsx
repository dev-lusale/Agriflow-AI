"use client";

import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/forms/action-form";
import { contactAction } from "@/server/public-actions";

export function ContactForm() {
  return (
    <ActionForm action={contactAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2" refresh={false}>
      <TextField name="name" label="Your name" required autoComplete="name" />
      <TextField name="email" label="Email" type="email" required autoComplete="email" />
      <TextField name="subject" label="Subject" required className="sm:col-span-2" />
      <TextAreaField name="message" label="Message" required rows={6} className="sm:col-span-2" />
      <p className="text-xs text-navy-500 sm:col-span-2">We use your details only to reply to this message. See our privacy notice.</p>
      <div className="sm:col-span-2">
        <SubmitButton>Send message</SubmitButton>
      </div>
    </ActionForm>
  );
}
