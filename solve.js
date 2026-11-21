// csv-reader-speed-01: a faster drop-in for csv-reader 1.0.0 (make.fun's own reference program).
// run(input) returns, for every case's input {text, header}, exactly the answer csv-reader 1.0.0
// returns: {columns, rows, errors}. The policy (from the competition brief):
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside a quoted field a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled, "" inside it one quote and
//     each CRLF or lone CR inside it read as LF; what follows its closing quote, up to the next comma or line
//     break, is appended as it stands (quote_junk, when the field ends); a quote that never closes is a literal
//     character, and the text after it is read again as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the records after it (every record
//     when header is false), each padded with "" (short_row, with fields: its field count) or cut (long_row, with
//     extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}: line the 1-based line its record starts on (every LF, CRLF and lone CR
//     inside a quoted field counted), row its record's index in rows (null for the header), in the order met, a
//     field's quote_junk when the field ends and a record's short_row or long_row when the record ends.
//
// Speed: the reference reads one character at a time and builds every field a character at a time. This reader
// scans with indexOf instead, so an ordinary field is a single slice and a quoted field is one slice per doubled
// quote; only a quoted field that actually holds a line break pays for counting and normalising it. Pure: no clock,
// no randomness, no locale, nothing kept from one call to the next.

const COMMA = 'comma';
const LINE_BREAK = 'line break';
const END = 'end';

/** csv-reader 1.0.0's answer for one case's input, {text, header}: {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  // The next delimiter of an unquoted field is found with indexOf, not one indexOf per delimiter: a lone
  // CR far ahead would make indexOf('\r') scan the rest of the text on every field. Instead the comma (or
  // the line end) bounds the segment, and a CR is only looked for inside that short segment.

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `value` up to the next comma or line break: a CR not followed by LF is
  // dropped (stray_cr). Returns the field and how it ended; `added` counts the characters kept.
  function readUnquoted(value, added) {
    let p = pos;
    while (true) {
      // The next comma bounds the field, or the next LF when no comma comes first. A CR only matters
      // inside that segment, so it is looked for there and nowhere further ahead.
      const c = text.indexOf(',', p);
      const n = text.indexOf('\n', p);
      let d;
      let kind; // 1: comma, 2: LF, 0: neither (the text ends)
      if (c === -1 && n === -1) {
        d = text.length;
        kind = 0;
      } else if (c === -1 || (n !== -1 && n < c)) {
        d = n;
        kind = 2;
      } else {
        d = c;
        kind = 1;
      }
      const seg = text.slice(p, d);
      const ri = seg.indexOf('\r');
      if (ri !== -1) {
        const r = p + ri;
        if (text.charCodeAt(r + 1) === 10) {
          value += seg.slice(0, ri);
          added += ri;
          pos = r + 2;
          line += 1;
          return { value, ended: LINE_BREAK, added };
        }
        error('stray_cr');
        value += seg.slice(0, ri);
        added += ri;
        p = r + 1;
        pos = r + 1;
        continue;
      }
      if (kind === 1) {
        value += seg;
        added += d - p;
        pos = d + 1;
        return { value, ended: COMMA, added };
      }
      if (kind === 2) {
        value += seg;
        added += d - p;
        pos = d + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      value += seg;
      added += d - p;
      pos = text.length;
      return { value, ended: END, added };
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let p = pos + 1;
    let segStart = p;
    let parts = null;
    let value;
    while (true) {
      const q = text.indexOf('"', p);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        error('unterminated_quote');
        return readUnquoted('"', 0);
      }
      if (text.charCodeAt(q + 1) === 34) {
        // A doubled quote: one quote in the value, and the field goes on.
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, q), '"');
        p = q + 2;
        segStart = q + 2;
        continue;
      }
      // The closing quote. What was read is one slice, or the parts joined.
      if (parts === null) {
        value = text.slice(segStart, q);
      } else {
        parts.push(text.slice(segStart, q));
        value = parts.join('');
      }
      // Each CRLF or lone CR inside the quotes is one LF, and each of them is one line.
      if (value.indexOf('\r') !== -1 || value.indexOf('\n') !== -1) {
        let n = 0;
        for (let i = 0; i < value.length; i++) {
          const c = value.charCodeAt(i);
          if (c === 10) n++;
          else if (c === 13) {
            n++;
            if (value.charCodeAt(i + 1) === 10) i++;
          }
        }
        line += n;
        value = value.replace(/\r\n?/g, '\n');
      }
      pos = q + 1;
      if (pos >= text.length) return { value, ended: END };
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        return { value, ended: COMMA };
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      // What follows the closing quote is appended as it stands, up to the next comma or line break.
      const junk = readUnquoted(value, 0);
      if (junk.added > 0) error('quote_junk');
      return junk;
    }
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < text.length) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= text.length) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('', 0);
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
