"use client";
import { useState } from "react";
export default function SmsBody({
  body,
  locked,
}: {
  body: string;
  locked: boolean;
}) {
  const [text, setText] = useState(body);
  return (
    <label className="block space-y-2 text-sm">
      SMS à envoyer
      <textarea
        name="body"
        required
        minLength={25}
        maxLength={450}
        rows={5}
        readOnly={locked}
        className="w-full rounded-lg border bg-white p-3"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <span className="block text-xs text-slate-500">
        {text.length} caractères · Les SMS longs ou avec certains caractères
        peuvent compter pour plusieurs SMS. Conservez FLEX-WEB, STOP et le lien
        d’information.
      </span>
    </label>
  );
}
