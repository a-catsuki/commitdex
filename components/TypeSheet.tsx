import { CREATURE_TYPES } from "@/lib/types";
import { TYPE_META } from "@/lib/type-meta";

export function TypeSheet() {
  return (
    <section className="types" id="types">
      <h2 className="types__head">Eight types. That is the whole taxonomy.</h2>
      <table className="spec-sheet">
        <caption className="prompt__sr">Commit creature types</caption>
        <thead>
          <tr>
            <th>Type</th>
            <th>What it captures</th>
            <th>Example</th>
          </tr>
        </thead>
        <tbody>
          {CREATURE_TYPES.map((type) => {
            const meta = TYPE_META[type];
            return (
              <tr key={type}>
                <th scope="row">
                  <span
                    className="type-swatch"
                    style={{ background: `var(${meta.cssVar})` }}
                    aria-hidden="true"
                  />
                  {meta.label}
                </th>
                <td>{meta.trait}</td>
                <td>
                  <code>{meta.example}</code>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
