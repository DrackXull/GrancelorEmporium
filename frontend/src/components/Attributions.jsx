// frontend/src/components/Attributions.jsx
import React from "react";

export default function Attributions() {
  return (
    <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8, lineHeight: 1.25 }}>
      <div>
        This app includes material from the D&D System Reference Document 5.x by Wizards of the Coast LLC,
        licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.
      </div>
      <div>
        This app also includes mechanics licensed under the Open RPG Creative (ORC) License. ORC text © Azora Law.
        No sponsorship or endorsement is implied.
      </div>
    </div>
  );
}
