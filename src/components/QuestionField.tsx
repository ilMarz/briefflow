"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  CUSTOM_ANSWER_MAX,
  FIELD_OPTIONS,
  QUESTIONS,
  type FieldId,
} from "../shared/contracts";

/** One closed question: choice pills with a preselected default and, where allowed, a custom value. */
export default function QuestionField({
  id,
  value,
  onChange,
}: {
  id: FieldId;
  value?: string;
  onChange: (value: string) => void;
}) {
  const { options, default: fallback, custom } = FIELD_OPTIONS[id];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const current = value || fallback;
  const added = value && !options.includes(value) ? value : undefined;

  function commit() {
    const next = draft.trim().slice(0, CUSTOM_ANSWER_MAX);
    if (!next) return;
    onChange(next);
    setDraft("");
    setAdding(false);
  }

  return (
    <fieldset className="choice-group">
      <legend>{QUESTIONS[id]}</legend>
      <div className="choices">
        {(added ? [...options, added] : options).map((option) => (
          <label className="choice" key={option}>
            <input
              type="radio"
              name={`question-${id}`}
              value={option}
              checked={current === option}
              onChange={() => onChange(option)}
            />
            <span>{option}</span>
          </label>
        ))}
        {added && (
          <button
            type="button"
            className="choice-remove"
            aria-label={`Rimuovi ${added}`}
            onClick={() => onChange(fallback)}
          >
            <X size={12} />
          </button>
        )}
        {custom && !added && !adding && (
          <button
            type="button"
            className="choice-add"
            onClick={() => setAdding(true)}
          >
            <Plus size={13} />
            {custom.button}
          </button>
        )}
      </div>
      {custom && adding && (
        <div className="choice-custom">
          <input
            autoFocus
            maxLength={CUSTOM_ANSWER_MAX}
            placeholder={custom.placeholder}
            aria-label={custom.placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setAdding(false);
              }
            }}
          />
          <button type="button" onClick={commit} disabled={!draft.trim()}>
            Aggiungi
          </button>
          <button type="button" onClick={() => setAdding(false)}>
            Annulla
          </button>
        </div>
      )}
    </fieldset>
  );
}
