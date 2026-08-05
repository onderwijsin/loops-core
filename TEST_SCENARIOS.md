# Comprehensive LMX parser test scenarios

## 0. Test-harness conventions

For every scenario, tests should verify more than `success` or `failure`.

### For accepted documents, verify

- Parsing succeeds without warnings unless warnings are explicitly part of the parser contract.
- The returned root/document node has the expected children.
- Tags retain their exact semantic type.
- Attributes retain their exact string values unless normalization is explicitly intended.
- Text nodes are normalized according to the documented whitespace rules.
- Child order is preserved.
- Attribute order does not affect the AST.
- Source locations point to the correct tag, attribute, or text range.
- Serializing and reparsing produces an equivalent AST.
- Parsing the same input repeatedly produces identical output.
- Input strings are not mutated.
- No environment-specific behavior exists.

### For rejected documents, verify

- Parsing or validation fails deterministically.
- At least one useful issue is returned.
- The issue identifies the correct tag, attribute, or source location.
- The error distinguishes XML syntax errors from LMX semantic errors.
- One invalid construct does not suppress unrelated issues when multi-error reporting is supported.
- Errors never expose internal stack traces to normal callers.
- Malformed input never causes a process crash, infinite loop, runaway recursion, or excessive allocation.

---

# 1. Empty input and document boundaries

## DOC-001 — Empty string

Parse `""`.

Expected: reject because the document contains no top-level block content, unless an empty document is intentionally supported. Lock the intended behavior in a test.

## DOC-002 — Whitespace-only document

Parse spaces, tabs, and newlines only.

Expected: same result as an empty document.

## DOC-003 — Single valid block

Parse:

```xml
<Paragraph>Hello</Paragraph>
```

Expected: accept with exactly one top-level paragraph.

## DOC-004 — Multiple valid top-level blocks

Parse several headings, paragraphs, buttons, and dividers in sequence.

Expected: accept and preserve order.

## DOC-005 — Leading whitespace

Place spaces and newlines before the first tag.

Expected: accept and ignore structural whitespace.

## DOC-006 — Trailing whitespace

Place spaces and newlines after the final tag.

Expected: accept and ignore structural whitespace.

## DOC-007 — Whitespace between top-level blocks

Use blank lines and indentation between tags.

Expected: accept without creating meaningful top-level text nodes.

## DOC-008 — Top-level plain text only

Parse:

```xml
Hello world
```

Expected: reject.

## DOC-009 — Text before a valid block

Parse:

```xml
Hello
<Paragraph>World</Paragraph>
```

Expected: reject the top-level text.

## DOC-010 — Text after a valid block

Parse:

```xml
<Paragraph>Hello</Paragraph>
World
```

Expected: reject the top-level text.

## DOC-011 — Text between blocks

Parse:

```xml
<Paragraph>One</Paragraph>
invalid
<Paragraph>Two</Paragraph>
```

Expected: reject the intervening top-level text.

## DOC-012 — Top-level variable only

Parse:

```xml
{contact.firstName}
```

Expected: reject.

## DOC-013 — Top-level variable between blocks

Expected: reject even when the surrounding blocks are valid.

## DOC-014 — XML declaration

Parse:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Paragraph>Hello</Paragraph>
```

The docs do not specify whether XML declarations are accepted. Choose the intended behavior and lock it down.

## DOC-015 — UTF-8 BOM

Prefix the document with a UTF-8 byte-order mark.

Expected: either accept transparently or reject clearly; never interpret the BOM as top-level text.

## DOC-016 — Comments between blocks

Parse XML comments before, between, and after valid blocks.

The docs do not specify comment support. Decide whether comments are ignored, preserved, or rejected.

## DOC-017 — Comment inside inline content

Test a comment between words in a paragraph.

Verify whether it affects whitespace normalization.

## DOC-018 — Processing instruction

Parse an XML processing instruction.

Expected: reject unless explicitly supported.

## DOC-019 — DOCTYPE declaration

Parse a `DOCTYPE`.

Expected: reject. External entity processing should not be enabled.

## DOC-020 — CDATA at the top level

Expected: reject as top-level text.

## DOC-021 — CDATA inside a paragraph

The docs do not define CDATA behavior. Prefer treating its contents as ordinary text or rejecting it consistently.

## DOC-022 — Multiple document fragments

Parse two complete LMX sequences concatenated together.

Because LMX is itself a sequence of top-level blocks rather than a single wrapper root, this may be valid. Verify the parser handles this intentionally rather than relying accidentally on a generic single-root XML parser.

## DOC-023 — Artificial wrapper element

Parse:

```xml
<Root>
  <Paragraph>Hello</Paragraph>
</Root>
```

Expected: reject unknown `Root`.

## DOC-024 — Only `<Style />`

Parse a document containing only a style node.

The docs call style optional metadata but do not explicitly require visible content. Decide and test whether this is valid.

## DOC-025 — Very large number of top-level blocks

Parse thousands of valid paragraphs.

Expected: no stack overflow, pathological slowdown, or order corruption.

---

# 2. Core XML syntax

## XML-001 — Correct matching tags

Verify a normal opening and closing tag pair.

## XML-002 — Mismatched closing tag

```xml
<Paragraph>Hello</H1>
```

Expected: XML syntax error.

## XML-003 — Missing closing tag

```xml
<Paragraph>Hello
```

Expected: XML syntax error.

## XML-004 — Extra closing tag

```xml
<Paragraph>Hello</Paragraph></Paragraph>
```

Expected: XML syntax error.

## XML-005 — Overlapping elements

```xml
<Paragraph><Strong>Hello</Paragraph></Strong>
```

Expected: XML syntax error.

## XML-006 — Unterminated opening tag

```xml
<Paragraph
```

Expected: XML syntax error.

## XML-007 — Unterminated attribute quote

```xml
<Paragraph align="center>
```

Expected: XML syntax error.

## XML-008 — Single-quoted attribute

```xml
<Paragraph align='center'>Hello</Paragraph>
```

XML allows this. Accept unless the implementation deliberately requires double quotes.

## XML-009 — Unquoted attribute

```xml
<Paragraph align=center>Hello</Paragraph>
```

Expected: reject.

## XML-010 — Attribute without a value

```xml
<Paragraph align>Hello</Paragraph>
```

Expected: reject.

## XML-011 — Duplicate attribute

```xml
<Paragraph align="left" align="right">Hello</Paragraph>
```

Expected: reject.

## XML-012 — Attribute spacing variations

Test:

```xml
<Paragraph align = "center">
```

Expected: accept.

## XML-013 — Newlines between attributes

Expected: accept.

## XML-014 — Tabs between attributes

Expected: accept.

## XML-015 — No whitespace between tag name and first attribute

```xml
<Paragraphalign="center">
```

Expected: parsed as an unknown tag or malformed XML, never as `Paragraph`.

## XML-016 — Empty normal element

```xml
<Paragraph></Paragraph>
```

Determine whether empty inline-content blocks are valid.

## XML-017 — Self-closed normally non-self-closing element

```xml
<Paragraph />
```

XML-wise this is equivalent to an empty paragraph. Decide whether LMX accepts it.

## XML-018 — Explicit opening and closing form for a self-closing tag

```xml
<Divider></Divider>
```

The docs describe divider as self-closing. Expected: reject if the grammar strictly requires `/>`.

## XML-019 — Space before self-closing slash

```xml
<Divider />
```

Expected: accept.

## XML-020 — No space before self-closing slash

```xml
<Divider/>
```

Expected: accept.

## XML-021 — Lowercase tag

```xml
<paragraph>Hello</paragraph>
```

Expected: reject as unknown due to case sensitivity.

## XML-022 — Mixed-case tag

```xml
<ParaGraph>Hello</ParaGraph>
```

Expected: reject.

## XML-023 — Correct tag with lowercase closing tag

Expected: XML mismatch or unknown closing tag failure.

## XML-024 — Namespace prefix

```xml
<lmx:Paragraph>Hello</lmx:Paragraph>
```

Expected: reject.

## XML-025 — Namespace declaration

Verify namespaces do not make unknown tags valid.

## XML-026 — HTML void-element syntax

```xml
<br>
```

Expected: reject; LMX requires `<Br />`.

## XML-027 — HTML entity supported by XML only when declared

Test `&nbsp;`.

Expected: reject unless the parser deliberately supports HTML entities. XML predefined entities are only `lt`, `gt`, `amp`, `apos`, and `quot`.

## XML-028 — Numeric character entity

Test `&#169;` and `&#x1F600;`.

Expected: decode correctly.

## XML-029 — Invalid numeric entity

Expected: reject.

## XML-030 — Raw ampersand in text

```xml
<Paragraph>A & B</Paragraph>
```

Expected: reject.

## XML-031 — Escaped ampersand

Expected: accept and produce text `A & B`.

## XML-032 — Escaped less-than sign

Expected: accept and produce `<`.

## XML-033 — Escaped quote in text

Expected: decode correctly.

## XML-034 — Escaped quote in attribute

Expected: decode correctly.

## XML-035 — Raw less-than in text

Expected: reject or interpret as malformed markup, never silently preserve.

## XML-036 — Raw greater-than in text

XML allows `>` in most text contexts. Verify intended behavior.

## XML-037 — Unicode element-name lookalike

Use visually similar Unicode characters in a tag name.

Expected: reject as unknown.

## XML-038 — Null byte

Expected: reject without crashing.

## XML-039 — Invalid UTF-8 sequence

When parsing bytes, reject with a decoding error.

## XML-040 — Control characters forbidden by XML

Test `U+0001`.

Expected: reject.

---

# 3. Known and unknown tags

## TAG-001 — Every documented top-level tag independently

Create one minimally valid document for each:

- `Style`
- `H1`
- `H2`
- `H3`
- `Paragraph`
- `Quote`
- `CodeBlock`
- `Button`
- `Image`
- `Divider`
- `OrderedList`
- `UnorderedList`
- `Columns`
- `Component`
- `Section`
- `Icons`

Expected: each is recognized in its valid form.

## TAG-002 — Every documented child-only tag in valid context

Test:

- `Br`
- `ListItem`
- `ColumnItem`
- `Icon`

## TAG-003 — Every documented inline tag in valid context

Test:

- `Strong`
- `Em`
- `Underline`
- `Code`
- `Strike`
- `Text`
- `Link`

## TAG-004 — Unknown top-level tag

Expected: reject.

## TAG-005 — Unknown child tag

Place an unknown tag inside a valid container.

Expected: reject.

## TAG-006 — Unknown inline tag

Place it inside a paragraph.

Expected: reject.

## TAG-007 — HTML tag

Test `div`, `span`, `p`, `a`, `img`, and `br`.

Expected: reject.

## TAG-008 — MJML tag

Test `<mj-text>`.

Expected: reject.

## TAG-009 — Near-match typo

Test `<Paragaph>`.

Expected: reject and ideally suggest `Paragraph`.

## TAG-010 — Tag with leading or trailing whitespace in its name

Expected: malformed XML or unknown tag.

## TAG-011 — Child-only tag at top level

Individually test `Br`, `ListItem`, `ColumnItem`, and `Icon`.

Expected: reject.

## TAG-012 — Inline tag at top level

Individually test all inline tags.

Expected: reject.

## TAG-013 — Style inside another block

Place `<Style />` inside `Section`, `ColumnItem`, `Component`, and `Paragraph`.

Expected: reject.

---

# 4. `<Style />`

The style tag is optional, self-closing, top-level only, and allowed at most once.

## STYLE-001 — Minimal style

```xml
<Style />
<Paragraph>Hello</Paragraph>
```

Expected: accept.

## STYLE-002 — Style with `themeId`

Expected: accept.

## STYLE-003 — Style with every documented attribute

Build one style containing all documented attributes with syntactically valid values.

Expected: accept and retain every value.

## STYLE-004 — Style before content

Expected: accept.

## STYLE-005 — Style after content

The docs say top-level but do not state it must be first. Expected: accept unless Loops requires first position.

## STYLE-006 — Style between blocks

Expected: accept if position is unrestricted.

## STYLE-007 — Two style tags

Expected: reject.

## STYLE-008 — Three style tags

Expected: report duplicate-style validation cleanly.

## STYLE-009 — Non-self-closing style

```xml
<Style></Style>
```

Expected: reject if self-closing syntax is strictly enforced.

## STYLE-010 — Style with child content

Expected: reject.

## STYLE-011 — Unknown style attribute

Expected: reject.

## STYLE-012 — Misspelled style attribute

Expected: reject.

## STYLE-013 — Attribute with wrong casing

For example `bodycolor`.

Expected: reject.

## STYLE-014 — Empty `themeId`

Determine whether an empty identifier is syntactically valid or rejected.

## STYLE-015 — Theme identifier with spaces

Determine parser-level validation.

## STYLE-016 — Theme identifier with Unicode

Determine parser-level validation.

## STYLE-017 — Valid `bodyFontCategory`

Test every allowed value:

- `ui-sans-serif`
- `ui-serif`
- `ui-monospace`
- `sans-serif`
- `serif`
- `monospace`

## STYLE-018 — Invalid `bodyFontCategory`

Test arbitrary value, wrong casing, leading space, and trailing space.

Expected: reject without trimming unless normalization is explicitly intended.

## STYLE-019 — Font family with spaces

Test `"Noto Sans"`.

Expected: accept.

## STYLE-020 — Empty font family

Decide and lock down behavior.

## STYLE-021 — Style numeric attributes as quoted integers

Expected: accept.

## STYLE-022 — Numeric attributes as quoted decimals

The docs say `number` but do not define integer-only behavior. Test and decide.

## STYLE-023 — Negative numeric style values

Test padding, border width, font size, radius, and line height.

Prefer rejecting physically invalid negative values.

## STYLE-024 — Zero numeric values

Expected: accept where zero is meaningful.

## STYLE-025 — Extremely large numeric values

Expected: reject by range or accept without numeric overflow. Never coerce to infinity.

## STYLE-026 — Numeric string with units

Test `"16px"`.

Expected: reject because numbers are strings containing numeric values, not CSS lengths.

## STYLE-027 — Numeric string with surrounding whitespace

Test `" 16 "`.

Decide whether values are trimmed or rejected.

## STYLE-028 — Scientific notation

Test `"1e3"`.

Decide and lock down.

## STYLE-029 — `NaN`

Expected: reject.

## STYLE-030 — `Infinity`

Expected: reject.

## STYLE-031 — Valid hex colors

Test ordinary six-digit values.

## STYLE-032 — Lowercase hex colors

Expected: accept.

## STYLE-033 — Uppercase hex colors

Expected: accept.

## STYLE-034 — Three-digit hex color

The docs only call the type `hex`. Determine whether shorthand is accepted.

## STYLE-035 — Eight-digit hex color

Determine alpha-channel support.

## STYLE-036 — Hex without `#`

Expected: reject unless explicitly supported.

## STYLE-037 — Invalid hex digits

Expected: reject.

## STYLE-038 — CSS named color

Expected: reject.

## STYLE-039 — CSS function color

Test `rgb(...)`.

Expected: reject.

## STYLE-040 — Style precedence representation

Parse a style defining defaults plus child tags overriding those defaults.

The parser need not resolve rendering styles, but the AST must preserve both layers accurately.

---

# 5. Common block attributes

Headings, paragraphs, quotes, list items, and several structural blocks share styling attributes.

For every applicable tag, execute the following scenarios independently.

## BLOCK-001 — No optional attributes

Expected: accept.

## BLOCK-002 — Each optional attribute in isolation

Ensure every documented attribute is recognized on every tag that supports it.

## BLOCK-003 — All supported attributes together

Expected: accept.

## BLOCK-004 — Attribute in different order

Expected: identical AST semantics.

## BLOCK-005 — Attribute duplicated

Expected: reject.

## BLOCK-006 — Attribute valid on another tag but not this one

For example `textColor` on `Paragraph`.

Expected: reject.

## BLOCK-007 — Global-looking arbitrary attribute

Test `id`, `class`, `style`, and `data-*`.

Expected: reject.

## BLOCK-008 — Event-handler attribute

Test `onclick`.

Expected: reject.

## BLOCK-009 — Wrong attribute casing

Expected: reject.

## BLOCK-010 — Empty numeric attribute

Expected: reject.

## BLOCK-011 — Boolean supplied to numeric attribute

Test `"true"`.

Expected: reject.

## BLOCK-012 — Hex supplied to numeric attribute

Expected: reject.

## BLOCK-013 — Alignment accepted values

Test `left`, `center`, and `right`.

## BLOCK-014 — Alignment wrong casing

Test `Center`.

Expected: reject.

## BLOCK-015 — Alignment with whitespace

Determine whether values are trimmed.

## BLOCK-016 — Unknown alignment

Expected: reject.

---

# 6. Headings

Run the same core suite for `H1`, `H2`, and `H3`.

## HEAD-001 — Plain text heading

Expected: accept.

## HEAD-002 — Empty heading

Determine whether accepted.

## HEAD-003 — Heading containing a variable

Expected: accept.

## HEAD-004 — Heading containing each inline formatting tag

Expected: accept.

## HEAD-005 — Heading containing nested inline tags

Expected: accept if arbitrary inline nesting is supported.

## HEAD-006 — Heading containing `<Br />`

Expected: accept because headings are inline-content blocks.

## HEAD-007 — Heading containing a block tag

Test nested `Paragraph`.

Expected: reject.

## HEAD-008 — Heading containing `ListItem`

Expected: reject.

## HEAD-009 — Heading containing `ColumnItem`

Expected: reject.

## HEAD-010 — Heading containing `Icon`

Expected: reject.

## HEAD-011 — Heading with all documented attributes

Expected: accept.

## HEAD-012 — Heading with unsupported `textColor`

The heading attribute table does not list it.

Expected: reject.

## HEAD-013 — Heading with `href`

Expected: reject.

## HEAD-014 — Mixed text, variables, and inline elements

Expected: preserve exact semantic order.

## HEAD-015 — Whitespace around inline nodes

Expected: collapse according to inline-content whitespace rules.

---

# 7. Paragraphs

## PARA-001 — Plain text

Expected: accept.

## PARA-002 — Empty paragraph

Decide and lock down.

## PARA-003 — Paragraph containing only whitespace

Verify normalized result.

## PARA-004 — Paragraph containing all supported inline tags

Expected: accept.

## PARA-005 — Paragraph containing `<Br />`

Expected: produce an explicit line-break node.

## PARA-006 — Consecutive `<Br />` tags

Expected: preserve both.

## PARA-007 — `<Br />` at the beginning

Expected: accept.

## PARA-008 — `<Br />` at the end

Expected: accept.

## PARA-009 — Paragraph containing a variable

Expected: accept.

## PARA-010 — Multiple adjacent variables

Expected: preserve as separate variable nodes or a deterministic equivalent.

## PARA-011 — Variable adjacent to punctuation

Expected: parse correctly.

## PARA-012 — Variable adjacent to text without spaces

Expected: parse correctly.

## PARA-013 — Paragraph containing nested paragraph

Expected: reject.

## PARA-014 — Paragraph containing heading

Expected: reject.

## PARA-015 — Paragraph containing button

Expected: reject.

## PARA-016 — Paragraph containing image

Expected: reject.

## PARA-017 — Paragraph containing section

Expected: reject.

## PARA-018 — Paragraph with every documented style attribute

Expected: accept.

---

# 8. Quotes

## QUOTE-001 — Plain text quote

Expected: accept.

## QUOTE-002 — Quote with inline formatting

Expected: accept.

## QUOTE-003 — Quote with variable

Expected: accept.

## QUOTE-004 — Quote with `<Br />`

Expected: accept.

## QUOTE-005 — Quote containing a block element

Expected: reject because quotes accept inline content only.

## QUOTE-006 — Empty quote

Decide and lock down.

## QUOTE-007 — Quote with all supported attributes

Expected: accept.

## QUOTE-008 — Quote with alignment

Expected: accept.

## QUOTE-009 — Quote with unsupported link attribute

Expected: reject.

---

# 9. Code blocks

Inline tags and variable parsing are disabled inside code blocks, and interior whitespace is preserved.

## CODEBLOCK-001 — Single-line code

Expected: accept and preserve text exactly.

## CODEBLOCK-002 — Multiline code

Expected: preserve newlines.

## CODEBLOCK-003 — Leading indentation

Expected: preserve it.

## CODEBLOCK-004 — Trailing indentation

Expected: preserve it.

## CODEBLOCK-005 — Blank lines

Expected: preserve their exact count.

## CODEBLOCK-006 — Tabs

Expected: preserve tabs rather than converting them to spaces.

## CODEBLOCK-007 — Repeated spaces

Expected: preserve exact runs.

## CODEBLOCK-008 — Variable-like braces

```xml
<CodeBlock>{contact.firstName}</CodeBlock>
```

Expected: literal text, not a variable node.

## CODEBLOCK-009 — Invalid variable syntax

Expected: literal text rather than a validation error.

## CODEBLOCK-010 — Inline-tag-looking text escaped

Expected: decode as literal `<Strong>` text.

## CODEBLOCK-011 — Actual inline tag inside code block

```xml
<CodeBlock><Strong>text</Strong></CodeBlock>
```

Expected: reject because inline tags are disabled, unless the parser’s contract treats child markup as serialized literal text. Prefer rejection.

## CODEBLOCK-012 — `<Br />` inside code block

Expected: reject as markup, not convert to a newline.

## CODEBLOCK-013 — Empty code block

Decide and lock down.

## CODEBLOCK-014 — All supported attributes

Expected: accept.

## CODEBLOCK-015 — Unsupported `align`

The code-block table does not include alignment.

Expected: reject.

## CODEBLOCK-016 — Entity decoding

Verify escaped XML characters become their literal character values while whitespace remains exact.

## CODEBLOCK-017 — CRLF normalization

Decide whether `\r\n` remains CRLF or normalizes to `\n`.

## CODEBLOCK-018 — Very large code block

Parse megabytes of code without quadratic behavior.

---

# 10. Buttons

Button content may contain plain text and variables, but not inline formatting tags.

## BUTTON-001 — Minimal empty button

Because `href` is not marked required, determine whether an empty button is valid.

## BUTTON-002 — Plain-text button without `href`

Expected: parser-level acceptance according to the documented optional attribute.

## BUTTON-003 — Button with static `href`

Expected: accept.

## BUTTON-004 — Button with only a variable as `href`

Expected: accept.

## BUTTON-005 — Button with variable embedded in a URL

Expected: accept.

## BUTTON-006 — Multiple variables in `href`

Expected: accept if each variable is valid.

## BUTTON-007 — Variable in button text

Expected: accept.

## BUTTON-008 — Multiple variables in button text

Expected: accept.

## BUTTON-009 — Contact variable in button text

Expected: syntax acceptance, subject to message-type validation.

## BUTTON-010 — Event variable in button text

Expected: syntax acceptance, subject to message type.

## BUTTON-011 — Data variable in button text

Expected: syntax acceptance, subject to message type.

## BUTTON-012 — Inline `<Strong>` inside button

Expected: reject.

## BUTTON-013 — Inline `<Text>` inside button

Expected: reject.

## BUTTON-014 — `<Br />` inside button

The docs permit only plain text and variables. Expected: reject.

## BUTTON-015 — Block tag inside button

Expected: reject.

## BUTTON-016 — Empty `href`

Determine whether accepted as an empty URL or rejected.

## BUTTON-017 — Relative `href`

The attribute type is `url`. Determine whether URLs must be absolute.

## BUTTON-018 — `mailto:` URL

Determine supported scheme behavior.

## BUTTON-019 — `tel:` URL

Determine supported scheme behavior.

## BUTTON-020 — Fragment URL

Determine supported behavior.

## BUTTON-021 — Unsafe URL scheme

Test `javascript:`.

Expected: reject.

## BUTTON-022 — Data URL

Expected: reject unless explicitly allowed.

## BUTTON-023 — URL containing escaped ampersands

Expected: decode correctly.

## BUTTON-024 — Raw ampersand in URL attribute

Expected: XML syntax rejection.

## BUTTON-025 — `notrack="true"`

Expected: accept.

## BUTTON-026 — `notrack="false"`

Since boolean values are passed as strings, determine whether both values are accepted.

## BUTTON-027 — Invalid boolean value

Test `"yes"`, `"1"`, and wrong casing.

Expected: reject.

## BUTTON-028 — Boolean attribute without quotes

Expected: reject.

## BUTTON-029 — Every alignment value

Expected: accept.

## BUTTON-030 — All style attributes

Expected: accept.

## BUTTON-031 — Unsupported `dynamicSrc`

Expected: reject.

## BUTTON-032 — Unsupported variable in `bgColor`

Expected: reject.

## BUTTON-033 — Unsupported variable in `align`

Expected: reject.

## BUTTON-034 — Variable with malformed braces in `href`

Expected: reject as invalid variable syntax rather than accepting a suspicious URL.

## BUTTON-035 — Variable-looking encoded braces

Test `%7Bcontact.userId%7D`.

Expected: ordinary URL content, not a variable.

## BUTTON-036 — Text whitespace collapse

Indented multiline button text should normalize predictably.

---

# 11. Images

`src` is required, must be a Loops-hosted static URL, must not contain variables, and the tag is self-closing.

## IMAGE-001 — Minimal valid image

Use only a valid Loops-hosted `src`.

Expected: accept.

## IMAGE-002 — Missing `src`

Expected: reject.

## IMAGE-003 — Empty `src`

Expected: reject.

## IMAGE-004 — Loops-hosted HTTPS image

Expected: accept.

## IMAGE-005 — Loops-hosted HTTP image

Determine whether HTTPS is required.

## IMAGE-006 — External static `src`

Expected: reject.

## IMAGE-007 — Lookalike Loops hostname

For example `images.vialoops.com.attacker.example`.

Expected: reject.

## IMAGE-008 — Subdomain lookalike

Expected: reject.

## IMAGE-009 — Different casing in hostname

URL hostnames are case-insensitive. Verify intended host validation.

## IMAGE-010 — Port on Loops hostname

Determine whether allowed.

## IMAGE-011 — Credentials in image URL

Expected: reject.

## IMAGE-012 — Relative image URL

Expected: reject.

## IMAGE-013 — Variable-only `src`

Expected: reject with an unsupported-dynamic-attribute issue.

## IMAGE-014 — Embedded variable in `src`

Expected: reject.

## IMAGE-015 — Escaped braces in `src`

Determine whether treated as literal URL content or rejected by URL validation.

## IMAGE-016 — Valid static placeholder plus `dynamicSrc`

Expected: accept.

## IMAGE-017 — Contact variable as `dynamicSrc`

Expected: accept subject to message type.

## IMAGE-018 — Event variable as `dynamicSrc`

Expected: accept subject to workflow context.

## IMAGE-019 — Data variable as `dynamicSrc`

Expected: accept subject to transactional context.

## IMAGE-020 — Static external URL in `dynamicSrc`

The prose says externally hosted images can use `dynamicSrc` as the external URL, while examples emphasize variables. Verify static external dynamic sources are accepted if intended.

## IMAGE-021 — Mixed text and variable in `dynamicSrc`

Test a URL such as `https://example.com/{contact.userId}.png`.

The docs describe a URL containing a variable. Expected: accept.

## IMAGE-022 — Multiple variables in `dynamicSrc`

Determine whether supported.

## IMAGE-023 — `dynamicSrc` without `src`

Expected: reject because the placeholder remains required.

## IMAGE-024 — Invalid variable in `dynamicSrc`

Expected: reject.

## IMAGE-025 — Variable in `alt`

Expected: accept.

## IMAGE-026 — Static and variable text in `alt`

Expected: accept.

## IMAGE-027 — Variable in image `href`

Expected: accept.

## IMAGE-028 — Variable in image `width`

Expected: reject.

## IMAGE-029 — Variable in image `borderRadius`

Expected: reject.

## IMAGE-030 — Width omitted

Expected: accept.

## IMAGE-031 — Width exactly `600`

Expected: accept.

## IMAGE-032 — Width below `600`

Expected: accept.

## IMAGE-033 — Width `601`

Expected: reject or clamp according to the intended parser contract. Prefer validation rejection.

## IMAGE-034 — Width zero

Determine whether valid.

## IMAGE-035 — Negative width

Expected: reject.

## IMAGE-036 — Decimal width

Determine integer requirements.

## IMAGE-037 — Extremely large width

Expected: reject without overflow.

## IMAGE-038 — Width containing units

Expected: reject.

## IMAGE-039 — All alignment values

Expected: accept.

## IMAGE-040 — Invalid alignment

Expected: reject.

## IMAGE-041 — `notrack="true"` without `href`

Determine whether accepted as harmless metadata.

## IMAGE-042 — Unsafe `href` scheme

Expected: reject.

## IMAGE-043 — Non-self-closing image

Expected: reject if grammar requires self-closing syntax.

## IMAGE-044 — Image containing text children

Expected: reject.

## IMAGE-045 — Image containing block children

Expected: reject.

## IMAGE-046 — Unsupported `title` attribute

Expected: reject.

## IMAGE-047 — Image filename with `.jpg`

Expected: accept.

## IMAGE-048 — Image filename with `.png`

Expected: accept.

## IMAGE-049 — Dynamic source ending in unsupported extension

The docs call for email-safe extensions. Test `.svg`, `.webp`, `.gif`, no extension, query-string extension, and uppercase extensions.

Decide which checks belong to the parser versus send-time validation.

## IMAGE-050 — Query and fragment in `src`

Expected: URL parsing remains correct.

---

# 12. Dividers

## DIV-001 — Minimal divider

Expected: accept.

## DIV-002 — All supported attributes

Expected: accept.

## DIV-003 — Width zero

Determine whether accepted.

## DIV-004 — Width `100`

Expected: accept.

## DIV-005 — Width over `100`

Because width is a percentage, prefer rejecting.

## DIV-006 — Negative width

Expected: reject.

## DIV-007 — Decimal width

Determine allowed numeric form.

## DIV-008 — Valid alignments

Expected: accept.

## DIV-009 — Invalid alignment

Expected: reject.

## DIV-010 — Valid hex color

Expected: accept.

## DIV-011 — Unsupported `href`

Expected: reject.

## DIV-012 — Variable in color

Expected: reject.

## DIV-013 — Non-self-closing divider

Expected: reject if strictly enforced.

## DIV-014 — Divider with text

Expected: reject.

## DIV-015 — Divider with child tag

Expected: reject.

---

# 13. Line breaks

## BR-001 — `<Br />` in paragraph

Expected: accept.

## BR-002 — `<Br />` in heading

Expected: accept.

## BR-003 — `<Br />` in quote

Expected: accept.

## BR-004 — `<Br />` in list item

Expected: accept.

## BR-005 — `<Br />` inside inline formatting

Expected: accept if inline elements may contain inline content.

## BR-006 — `<Br />` at top level

Expected: reject.

## BR-007 — `<Br />` in button

Expected: reject.

## BR-008 — `<Br />` in code block

Expected: reject as markup.

## BR-009 — `<Br />` in columns directly

Expected: reject because columns may only contain column items.

## BR-010 — `<Br />` with an attribute

Expected: reject.

## BR-011 — Non-self-closing `<Br></Br>`

Expected: reject if strict.

## BR-012 — Lowercase `<br />`

Expected: reject.

---

# 14. Ordered and unordered lists

Both list containers must contain at least one `ListItem` and no other child elements.

## LIST-001 — Ordered list with one item

Expected: accept.

## LIST-002 — Ordered list with multiple items

Expected: accept and preserve order.

## LIST-003 — Unordered list with one item

Expected: accept.

## LIST-004 — Unordered list with multiple items

Expected: accept.

## LIST-005 — Empty ordered list

Expected: reject.

## LIST-006 — Empty unordered list

Expected: reject.

## LIST-007 — Whitespace-only list

Expected: reject as containing no item.

## LIST-008 — Plain text directly inside list

Expected: reject.

## LIST-009 — Paragraph directly inside list

Expected: reject.

## LIST-010 — Mixed `ListItem` and paragraph

Expected: reject.

## LIST-011 — Nested ordered list directly inside list

Expected: reject.

## LIST-012 — Nested unordered list directly inside list

Expected: reject.

## LIST-013 — `ListItem` plus XML comments

If comments are supported, they should not count as invalid children.

## LIST-014 — Valid alignments

Expected: accept.

## LIST-015 — Invalid alignment

Expected: reject.

## LIST-016 — Ordered list with `start="1"`

Expected: accept.

## LIST-017 — Ordered list with non-default positive start

Expected: accept.

## LIST-018 — Ordered list with `start="0"`

Determine whether accepted.

## LIST-019 — Ordered list with negative start

Determine expected behavior.

## LIST-020 — Ordered list with decimal start

Prefer reject.

## LIST-021 — Ordered list with nonnumeric start

Expected: reject.

## LIST-022 — `start` on unordered list

Expected: reject because it is ordered-list-only.

## LIST-023 — Variable in `start`

Expected: reject.

## LIST-024 — Extremely large number of items

Expected: parse without pathological behavior.

## LIST-025 — Deeply formatted item content

Expected: preserve inline nesting.

---

# 15. List items

## ITEM-001 — Plain text item

Expected: accept.

## ITEM-002 — Empty item

Determine whether accepted.

## ITEM-003 — Item containing a variable

Expected: accept.

## ITEM-004 — Item containing every inline tag

Expected: accept.

## ITEM-005 — Item containing `<Br />`

Expected: accept.

## ITEM-006 — Item containing paragraph

Expected: reject.

## ITEM-007 — Item containing another list item

Expected: reject.

## ITEM-008 — Item containing nested list

Expected: reject because only inline content is allowed.

## ITEM-009 — Item at top level

Expected: reject.

## ITEM-010 — Item inside section but not list

Expected: reject.

## ITEM-011 — Item inside columns directly

Expected: reject.

## ITEM-012 — Item with all supported attributes

Expected: accept.

## ITEM-013 — Item with alignment

The item attribute table does not list alignment.

Expected: reject.

## ITEM-014 — Item with `start`

Expected: reject.

---

# 16. Columns

Columns must contain between two and four `ColumnItem` children, no other tags, with no nested columns.

## COLS-001 — Exactly two columns

Expected: accept.

## COLS-002 — Exactly three columns

Expected: accept.

## COLS-003 — Exactly four columns

Expected: accept.

## COLS-004 — Zero columns

Expected: reject.

## COLS-005 — One column

Expected: reject.

## COLS-006 — Five columns

Expected: reject.

## COLS-007 — One hundred columns

Expected: reject efficiently.

## COLS-008 — Plain text inside columns

Expected: reject, ignoring indentation-only whitespace.

## COLS-009 — Paragraph directly inside columns

Expected: reject.

## COLS-010 — Mixed column item and other block

Expected: reject.

## COLS-011 — Nested columns inside column item

Expected: reject.

## COLS-012 — Nested columns multiple levels deep

Expected: reject without recursion failure.

## COLS-013 — Column item directly inside another column item

Expected: reject.

## COLS-014 — Columns inside section

Expected: accept.

## COLS-015 — Columns inside component override

Expected: accept unless component-specific nesting forbids it. Nested component is forbidden, not columns.

## COLS-016 — Columns at top level

Expected: accept.

## COLS-017 — All supported attributes

Expected: accept.

## COLS-018 — Gap zero

Expected: accept.

## COLS-019 — Negative gap

Expected: reject.

## COLS-020 — Decimal gap

Determine behavior.

## COLS-021 — Valid widths for two columns

Test `"50,50"`.

## COLS-022 — Valid unequal widths

Test `"60,40"`.

## COLS-023 — Valid three-column widths

Test values totalling 100.

## COLS-024 — Valid four-column widths

Test values totalling 100.

## COLS-025 — Width count smaller than child count

Expected: reject.

## COLS-026 — Width count greater than child count

Expected: reject.

## COLS-027 — Widths total below 100

Expected: reject.

## COLS-028 — Widths total above 100

Expected: reject.

## COLS-029 — Empty widths string

Expected: reject.

## COLS-030 — Empty width segment

Test `"50,,50"`.

Expected: reject.

## COLS-031 — Trailing comma

Expected: reject.

## COLS-032 — Leading comma

Expected: reject.

## COLS-033 — Spaces around commas

Determine whether accepted and normalized.

## COLS-034 — Decimal percentages totalling 100

Determine whether decimals are supported.

## COLS-035 — Negative percentage

Expected: reject.

## COLS-036 — Zero-width column

Determine whether accepted.

## COLS-037 — Percentage signs included

Test `"50%,50%"`.

Expected: reject.

## COLS-038 — Non-numeric segment

Expected: reject.

## COLS-039 — Variable in widths

Expected: reject.

## COLS-040 — Valid vertical alignments

Test `top`, `middle`, and `bottom`.

## COLS-041 — Invalid vertical alignment

Expected: reject.

## COLS-042 — `stackOnMobile="true"`

Expected: accept.

## COLS-043 — `stackOnMobile="false"`

Expected: accept if normal boolean handling allows both.

## COLS-044 — Invalid `stackOnMobile`

Expected: reject.

## COLS-045 — `reverseOnMobile="true"`

Expected: accept.

## COLS-046 — Reverse without stacking

Determine whether this is parser-valid even if rendering has little effect.

## COLS-047 — Variables in boolean attributes

Expected: reject.

## COLS-048 — Large content inside each column

Expected: parse correctly.

---

# 17. Column items

## COLUMN-001 — Empty column item

Determine whether accepted.

## COLUMN-002 — Column with one block

Expected: accept.

## COLUMN-003 — Column with several blocks

Expected: accept and preserve order.

## COLUMN-004 — Column with every permissible block type

Construct a column containing headings, paragraph, quote, code block, button, image, divider, lists, component, section, and icons, excluding nested columns.

Expected: accept where no other nesting rule is violated.

## COLUMN-005 — Column containing style

Expected: reject.

## COLUMN-006 — Column containing column item

Expected: reject.

## COLUMN-007 — Column containing columns

Expected: reject.

## COLUMN-008 — Column containing top-level text

Text directly in a column is not a block tag.

Expected: reject non-whitespace text.

## COLUMN-009 — Column with attributes

Column items have no attributes.

Expected: reject any attribute.

## COLUMN-010 — Column item outside columns

Expected: reject.

---

# 18. Components

Components require `componentId`, may be self-closing, or may contain block children that override defaults. Nested components are forbidden.

## COMP-001 — Minimal self-closing component

Expected: accept.

## COMP-002 — Missing `componentId`

Expected: reject.

## COMP-003 — Empty `componentId`

Determine whether parser validation rejects it.

## COMP-004 — Component ID with hyphens

Expected: accept.

## COMP-005 — Component ID with underscores

Determine permitted identifier syntax.

## COMP-006 — Component ID with spaces

Determine behavior.

## COMP-007 — Non-self-closing component with no children

Determine whether accepted.

## COMP-008 — Component with one override block

Expected: accept.

## COMP-009 — Component with several override blocks

Expected: accept.

## COMP-010 — Component with every supported block type

Expected: accept except nested component and style.

## COMP-011 — Component containing component directly

Expected: reject.

## COMP-012 — Component nested indirectly through section

For example component → section → component.

The docs say nested component tags are not supported. Expected: reject indirect nesting as well.

## COMP-013 — Component inside column

Expected: accept.

## COMP-014 — Component inside section

Expected: accept, provided no ancestor component exists.

## COMP-015 — Component override containing plain text

Expected: reject top-level text within component override content.

## COMP-016 — Component override containing inline tag directly

Expected: reject.

## COMP-017 — Component override containing style

Expected: reject.

## COMP-018 — All supported component style attributes

Expected: accept.

## COMP-019 — Unsupported `href`

Expected: reject.

## COMP-020 — Unknown component ID

This likely requires external metadata rather than pure parsing. Test separately in contextual validation.

## COMP-021 — Very deep valid block content in component

Expected: parse without stack issues up to configured limits.

---

# 19. Sections

Sections contain block children and may be styled, clickable, bordered, or conditional. Nested sections are forbidden.

## SECTION-001 — Empty section

Determine whether accepted.

## SECTION-002 — Section with one block

Expected: accept.

## SECTION-003 — Section with several blocks

Expected: accept.

## SECTION-004 — Section with all permissible block types

Expected: accept except style and nested section.

## SECTION-005 — Direct nested section

Expected: reject.

## SECTION-006 — Indirect nested section through a column

Expected: reject if “nested sections” means any descendant section.

## SECTION-007 — Section inside component

Expected: accept unless the component itself is inside a section and indirect nesting results.

## SECTION-008 — Section inside column

Expected: accept.

## SECTION-009 — Plain text directly inside section

Expected: reject.

## SECTION-010 — Inline tag directly inside section

Expected: reject.

## SECTION-011 — Style inside section

Expected: reject.

## SECTION-012 — Static `href`

Expected: accept.

## SECTION-013 — Variable-only `href`

Expected: accept.

## SECTION-014 — Variable embedded in `href`

Expected: accept.

## SECTION-015 — Unsafe `href` scheme

Expected: reject.

## SECTION-016 — `notrack="true"`

Expected: accept.

## SECTION-017 — Invalid boolean `notrack`

Expected: reject.

## SECTION-018 — Border width and color both present

Expected: accept.

## SECTION-019 — Border width without color

The docs say it renders only when color is also set. Determine whether parser accepts but renderer ignores, emits a warning, or rejects.

## SECTION-020 — Border color without width

Same decision as above.

## SECTION-021 — Zero border width with color

Determine behavior.

## SECTION-022 — Negative border width

Expected: reject.

## SECTION-023 — All supported styling attributes

Expected: accept.

## SECTION-024 — Unsupported text content attribute

Expected: reject.

---

# 20. Conditional sections

## COND-001 — Contact variable with default operation

```xml
<Section if="{contact.plan}">
  <Paragraph>Visible</Paragraph>
</Section>
```

Expected: accept and represent `not_empty` semantically or leave the default implicit consistently.

## COND-002 — Event variable condition

Expected: accept only in workflow context.

## COND-003 — Data variable condition

Expected: accept only in transactional context.

## COND-004 — Empty `if`

Expected: reject.

## COND-005 — Unprefixed condition

Expected: reject.

## COND-006 — Literal text condition

Expected: reject.

## COND-007 — Variable surrounded by text

Expected: reject because `if` must be the whole variable reference.

## COND-008 — Two variables in `if`

Expected: reject.

## COND-009 — Expression in `if`

Expected: reject.

## COND-010 — Comparison syntax embedded in `if`

Expected: reject.

## COND-011 — Whitespace around variable in `if`

Test `" {contact.plan} "`.

Determine whether strict whole-value validation permits surrounding whitespace. Prefer rejection for deterministic semantics.

## COND-012 — `not_empty`

Expected: accept without `ifValue`.

## COND-013 — `empty`

Expected: accept without `ifValue`.

## COND-014 — `equal` with `ifValue`

Expected: accept for text-compatible variables.

## COND-015 — `not_equal` with `ifValue`

Expected: accept.

## COND-016 — `contains` with `ifValue`

Expected: accept.

## COND-017 — `not_contains` with `ifValue`

Expected: accept.

## COND-018 — `numeric_equal` with `ifValue`

Expected: accept for number-compatible variables.

## COND-019 — `numeric_not_equal` with `ifValue`

Expected: accept.

## COND-020 — `greater_than` with `ifValue`

Expected: accept.

## COND-021 — `less_than` with `ifValue`

Expected: accept.

## COND-022 — `true` operation

Expected: accept without `ifValue`.

## COND-023 — `false` operation

Expected: accept without `ifValue`.

## COND-024 — Unknown operation

Expected: reject.

## COND-025 — Operation wrong casing

Expected: reject.

## COND-026 — Value-requiring operation without `ifValue`

Test all eight such operators.

Expected: reject each.

## COND-027 — Presence operation with `ifValue`

The docs say it is ignored.

Expected: accept and either retain or discard it according to the AST contract. Test consistently.

## COND-028 — Boolean operation with `ifValue`

Expected: accepted but ignored according to the docs.

## COND-029 — `ifOperation` without `if`

The docs say it is ignored.

Expected: validate according to that rule rather than treating it as an active condition.

## COND-030 — `ifValue` without `if`

Expected: ignored according to the docs.

## COND-031 — Unsupported operation without `if`

The docs say `ifOperation` is ignored without `if`, but also say validation rejects unsupported operators. Clarify precedence and lock it down.

## COND-032 — Empty `ifValue`

For `equal`, determine whether empty string is a valid comparison value.

## COND-033 — Numeric operation with nonnumeric `ifValue`

Expected: reject when variable type metadata is known.

## COND-034 — Text operation against numeric property

Expected: contextual rejection if variable type metadata is available.

## COND-035 — Numeric operation against text property

Expected: contextual rejection.

## COND-036 — Boolean operation against text property

Expected: contextual rejection.

## COND-037 — Data variable with numeric operation

The docs say data variables are always text for condition operations.

Expected: reject numeric operations against data variables.

## COND-038 — Missing condition variable at send time

This is not a parser error. Integration test that the section is hidden rather than failing the send.

## COND-039 — Hidden section containing missing required variable

The docs say hidden content is dropped entirely. Integration test that variables inside it are not evaluated when hidden.

## COND-040 — Nested conditional sections

Since sections cannot nest, reject regardless of conditions.

## COND-041 — Escaped comparison text

Test `ifValue` containing `&amp;`, quotes, braces, and Unicode.

Expected: decode and retain accurately.

## COND-042 — Variable inside `ifValue`

The docs do not list `ifValue` as dynamic.

Expected: reject variable references there.

---

# 21. Icons container

Icons must contain between one and 100 `Icon` children and no other tags.

## ICONS-001 — One icon

Expected: accept.

## ICONS-002 — Several icons

Expected: accept and preserve order.

## ICONS-003 — Exactly 100 icons

Expected: accept.

## ICONS-004 — Zero icons

Expected: reject.

## ICONS-005 — 101 icons

Expected: reject.

## ICONS-006 — Very large number of icons

Expected: reject efficiently.

## ICONS-007 — Plain text inside icons

Expected: reject non-whitespace text.

## ICONS-008 — Paragraph inside icons

Expected: reject.

## ICONS-009 — Mixed icon and another tag

Expected: reject.

## ICONS-010 — Nested icons container

Expected: reject.

## ICONS-011 — All supported container attributes

Expected: accept.

## ICONS-012 — Valid alignments

Expected: accept.

## ICONS-013 — Invalid alignment

Expected: reject.

## ICONS-014 — Gap zero

Expected: accept.

## ICONS-015 — Negative gap

Expected: reject.

## ICONS-016 — Size zero

Determine behavior.

## ICONS-017 — Negative size

Expected: reject.

## ICONS-018 — Allowed documented colors

Test black, gray, and white.

## ICONS-019 — Other valid hex color

The attribute type says hex while notes list three colors. Determine whether only those three are allowed or merely examples/defaults.

## ICONS-020 — Variable in color

Expected: reject.

---

# 22. Individual icons

## ICON-001 — Minimal icon with name

Expected: accept.

## ICON-002 — Missing name

Expected: reject.

## ICON-003 — Empty name

Expected: reject.

## ICON-004 — Known icon name

Expected: accept.

## ICON-005 — Unknown icon name

Requires icon catalogue metadata. Test contextual validation separately.

## ICON-006 — Name wrong casing

Expected: reject if icon names are case-sensitive.

## ICON-007 — Name with surrounding whitespace

Determine behavior.

## ICON-008 — Icon with static `href`

Expected: accept.

## ICON-009 — Icon without `href`

Expected: accept.

## ICON-010 — Variable in icon `href`

Variables are not listed as supported for `Icon href`.

Expected: reject.

## ICON-011 — Unsafe icon `href`

Expected: reject.

## ICON-012 — `notrack="true"`

Expected: accept.

## ICON-013 — Invalid `notrack`

Expected: reject.

## ICON-014 — Icon at top level

Expected: reject.

## ICON-015 — Icon inside paragraph

Expected: reject.

## ICON-016 — Non-self-closing icon

Expected: reject if strict.

## ICON-017 — Icon with text child

Expected: reject.

## ICON-018 — Unsupported `color` on individual icon

Expected: reject; color belongs to the container.

---

# 23. Inline tags

Run the following suite for `Strong`, `Em`, `Underline`, `Code`, `Strike`, and `Text`.

## INLINE-001 — Plain text child

Expected: accept.

## INLINE-002 — Empty inline tag

Determine whether accepted.

## INLINE-003 — Variable child

Expected: accept.

## INLINE-004 — `<Br />` child

Expected: accept if arbitrary inline content nesting is allowed.

## INLINE-005 — Nested same inline tag

Expected: accept unless explicitly forbidden.

## INLINE-006 — Nested different inline tag

Expected: accept.

## INLINE-007 — Deep mixed inline nesting

Expected: parse to the configured depth limit.

## INLINE-008 — Block tag child

Expected: reject.

## INLINE-009 — List item child

Expected: reject.

## INLINE-010 — Icon child

Expected: reject.

## INLINE-011 — Top-level inline tag

Expected: reject.

## INLINE-012 — Inline tag directly inside section

Expected: reject.

## INLINE-013 — `textColor` valid hex

Expected: accept.

## INLINE-014 — Invalid text color

Expected: reject.

## INLINE-015 — Unsupported attribute

Expected: reject.

## INLINE-016 — Variable in `textColor`

Expected: reject.

## INLINE-017 — Whitespace spanning nested tags

Verify normalized text does not accidentally concatenate words.

Example:

```xml
<Paragraph>Hello <Strong>world</Strong> again</Paragraph>
```

Expected semantic text: `Hello world again`.

## INLINE-018 — No whitespace around nested tag

Expected not to invent spaces.

## INLINE-019 — Punctuation adjacent to nested tag

Expected not to invent spaces before punctuation.

## INLINE-020 — Several adjacent inline tags

Expected deterministic spacing.

---

# 24. Links

## LINK-001 — Static absolute HTTPS URL

Expected: accept.

## LINK-002 — Missing `href`

Expected: reject.

## LINK-003 — Empty `href`

Determine behavior.

## LINK-004 — Contact variable in `href`

Expected: accept.

## LINK-005 — Event variable in `href`

Expected: accept only in workflow context.

## LINK-006 — Data variable in `href`

Expected: accept only in transactional context.

## LINK-007 — Variable embedded in URL

Expected: accept.

## LINK-008 — Multiple variables in URL

Expected: accept.

## LINK-009 — Variable in link text

Expected: accept.

## LINK-010 — Nested inline formatting in link

Expected: accept if links can contain inline content.

## LINK-011 — Link inside another link

Expected: reject.

## LINK-012 — Block child inside link

Expected: reject.

## LINK-013 — Unsafe URL scheme

Expected: reject.

## LINK-014 — Relative URL

Determine behavior.

## LINK-015 — `mailto:` URL

Determine behavior.

## LINK-016 — URL with escaped query separators

Expected: decode correctly.

## LINK-017 — `notrack="true"`

Expected: accept.

## LINK-018 — `notrack="false"`

Expected: accept if both boolean values are supported.

## LINK-019 — Invalid `notrack`

Expected: reject.

## LINK-020 — Unsupported `target`

Expected: reject.

## LINK-021 — Variable in unsupported attribute

Expected: reject.

## LINK-022 — Link at top level

Expected: reject.

## LINK-023 — Link in button

Expected: reject because button inline formatting is forbidden.

---

# 25. Whitespace normalization

Outside code blocks, whitespace collapses like HTML. Between block tags, whitespace is ignored.

## WS-001 — Multiple spaces in paragraph text

Expected: collapse to one semantic space.

## WS-002 — Tabs in paragraph text

Expected: collapse.

## WS-003 — Newline in paragraph text

Expected: collapse.

## WS-004 — CRLF in paragraph text

Expected: collapse equivalently to LF.

## WS-005 — Leading whitespace in paragraph

Determine whether trimmed.

## WS-006 — Trailing whitespace in paragraph

Determine whether trimmed.

## WS-007 — Whitespace-only paragraph

Determine normalized AST and validity.

## WS-008 — Indentation around inline element

Ensure formatting indentation does not add accidental spaces beyond normal collapse rules.

## WS-009 — No whitespace between text and inline opening tag

Do not insert a space.

## WS-010 — No whitespace between inline closing tag and text

Do not insert a space.

## WS-011 — Newline before `<Br />`

Ensure the newline collapses independently and the explicit break remains.

## WS-012 — Newline after `<Br />`

Same verification.

## WS-013 — Several block tags with heavy indentation

No top-level text nodes should appear.

## WS-014 — Non-breaking space entity

If supported numerically, verify it is not collapsed as ordinary whitespace unless intended.

## WS-015 — Unicode whitespace

Test non-breaking space, em space, thin space, line separator, and ideographic space.

Define the normalization rules explicitly.

## WS-016 — Whitespace inside attribute values

Do not normalize arbitrary strings such as `alt`, `componentId`, and `ifValue` unless specified.

## WS-017 — Code-block whitespace compared with paragraph whitespace

Use identical source text and verify the different behavior.

## WS-018 — Round-trip pretty printing

Pretty-printing a parsed document must not change semantic text.

---

# 26. Dynamic-variable lexical syntax

Variables use `{contact.*}`, `{event.*}`, or `{data.*}` prefixes.

## VAR-001 — Basic contact variable

Expected: recognize.

## VAR-002 — Basic event variable

Expected: recognize.

## VAR-003 — Basic data variable

Expected: recognize.

## VAR-004 — Variable at beginning of text

Expected: recognize.

## VAR-005 — Variable at end of text

Expected: recognize.

## VAR-006 — Variable in middle of text

Expected: recognize.

## VAR-007 — Adjacent variables

Expected: recognize both.

## VAR-008 — Repeated identical variables

Expected: preserve both occurrences.

## VAR-009 — Variable followed by punctuation

Expected: recognize without consuming punctuation.

## VAR-010 — Variable preceded by punctuation

Expected: recognize.

## VAR-011 — Unprefixed variable

Expected: reject.

## VAR-012 — Editor event syntax

Test `{EVENT_PROPERTY:orderId}`.

Expected: reject.

## VAR-013 — Editor data syntax

Test `{DATA_VARIABLE:resetLink}`.

Expected: reject.

## VAR-014 — Unknown prefix

Expected: reject.

## VAR-015 — Prefix wrong casing

Test `{Contact.firstName}`.

Expected: reject.

## VAR-016 — Property name wrong casing

The parser should preserve it; contextual metadata validation may reject an unknown property.

## VAR-017 — Missing property name

Test `{contact.}`.

Expected: reject.

## VAR-018 — Missing dot

Test `{contactfirstName}`.

Expected: reject.

## VAR-019 — Extra dot

Test `{contact..firstName}`.

Expected: reject.

## VAR-020 — Nested property path

Test `{contact.profile.avatar}`.

The docs show one API name after the prefix. Determine whether dots inside names are allowed. Prefer rejection unless explicitly supported.

## VAR-021 — Spaces inside braces

Test `{ contact.firstName }`.

Expected: reject.

## VAR-022 — Space before property

Expected: reject.

## VAR-023 — Space after property

Expected: reject.

## VAR-024 — Empty braces

Expected: reject.

## VAR-025 — Missing closing brace

Expected: reject rather than silently treating it as text.

## VAR-026 — Missing opening brace

Expected: ordinary text or invalid brace syntax according to parser policy.

## VAR-027 — Extra opening brace

Test `{{contact.firstName}`.

Expected: reject or preserve one literal brace consistently.

## VAR-028 — Extra closing brace

Expected: reject or preserve consistently.

## VAR-029 — Escaped braces

The docs do not define a brace-escaping syntax. Test literal brace requirements explicitly.

## VAR-030 — Data variable with letters

Expected: accept.

## VAR-031 — Data variable with numbers

Expected: accept.

## VAR-032 — Data variable with underscore

Expected: accept.

## VAR-033 — Data variable with dash

Expected: accept.

## VAR-034 — Data variable beginning with a number

The docs say names may contain allowed characters but do not prohibit numeric first characters. Decide and test.

## VAR-035 — Data variable containing a dot

Expected: reject.

## VAR-036 — Data variable containing a space

Expected: reject.

## VAR-037 — Data variable containing Unicode letters

The docs restrict names to letters but do not clarify ASCII versus Unicode. Prefer explicit ASCII rules if matching an API-name grammar.

## VAR-038 — Data variable containing slash

Expected: reject.

## VAR-039 — Data variable containing colon

Expected: reject.

## VAR-040 — Data variable containing pipe

Expected: reject.

## VAR-041 — Contact variable unusual characters

Determine whether contact and event API names use the same lexical rules.

## VAR-042 — Very long variable name

Expected: handle within configured length limits.

## VAR-043 — Thousands of variables

Expected: no pathological parsing time.

## VAR-044 — Variable-like text in code block

Expected: literal.

## VAR-045 — Variable inside XML comment

If comments are supported, it must not become semantic dynamic content.

## VAR-046 — Variable inside CDATA

Define whether it is parsed or remains literal.

---

# 27. Variable placement

## PLACE-001 — Variable in heading content

Expected: accept.

## PLACE-002 — Variable in paragraph content

Expected: accept.

## PLACE-003 — Variable in quote content

Expected: accept.

## PLACE-004 — Variable in list-item content

Expected: accept.

## PLACE-005 — Variable inside each inline formatting tag

Expected: accept.

## PLACE-006 — Variable in button text

Expected: accept.

## PLACE-007 — Variable in button `href`

Expected: accept.

## PLACE-008 — Variable in link `href`

Expected: accept.

## PLACE-009 — Variable in image `alt`

Expected: accept.

## PLACE-010 — Variable in image `href`

Expected: accept.

## PLACE-011 — Variable in image `dynamicSrc`

Expected: accept.

## PLACE-012 — Variable in section `href`

Expected: accept.

## PLACE-013 — Whole variable in section `if`

Expected: accept.

## PLACE-014 — Variable at top level

Expected: reject.

## PLACE-015 — Variable inside code block

Expected: literal.

## PLACE-016 — Variable in image `src`

Expected: reject.

## PLACE-017 — Variable in style attribute

Expected: reject.

## PLACE-018 — Variable in heading styling attribute

Expected: reject.

## PLACE-019 — Variable in paragraph styling attribute

Expected: reject.

## PLACE-020 — Variable in button color

Expected: reject.

## PLACE-021 — Variable in divider width

Expected: reject.

## PLACE-022 — Variable in columns widths

Expected: reject.

## PLACE-023 — Variable in component ID

Expected: reject.

## PLACE-024 — Variable in icon name

Expected: reject.

## PLACE-025 — Variable in icon href

Expected: reject because it is not listed among supported dynamic attributes.

## PLACE-026 — Variable in `ifValue`

Expected: reject.

---

# 28. Message-type variable validation

The parser should accept a message context or expose a separate validator for campaign, workflow, and transactional documents.

## CTX-001 — Campaign with contact variable

Expected: accept.

## CTX-002 — Campaign with event variable

Expected: reject.

## CTX-003 — Campaign with data variable

Expected: reject.

## CTX-004 — Campaign with mixed contact and event variables

Expected: reject event usage while still identifying valid contact usage.

## CTX-005 — Campaign with event variable only in an attribute

Expected: reject.

## CTX-006 — Campaign with event variable only in hidden section

Static validation should still reject invalid message-type usage unless the API explicitly exempts hidden content.

## CTX-007 — Workflow with contact variable

Expected: accept.

## CTX-008 — Workflow with event variable

Expected: accept.

## CTX-009 — Workflow with data variable

Expected: reject.

## CTX-010 — Workflow with mixed contact and event variables

Expected: accept.

## CTX-011 — Transactional with data variable

Expected: accept.

## CTX-012 — Transactional with contact variable

Based on the docs, transactional LMX uses data variables. Expected: reject contact variables unless Loops explicitly supports them.

## CTX-013 — Transactional with event variable

Expected: reject.

## CTX-014 — No message context supplied

Define whether parsing remains syntax-only or returns an “unable to validate context” result.

## CTX-015 — Unknown message type

Expected: reject configuration rather than guess.

## CTX-016 — Wrong-cased message type

Expected: reject or normalize explicitly.

---

# 29. Variable metadata validation

These require contact-property, event-property, or data-variable definitions supplied to the validator.

## META-001 — Known contact property

Expected: accept.

## META-002 — Unknown contact property

Expected: reject or warn according to intended API parity.

## META-003 — Contact property wrong casing

Expected: reject as unknown.

## META-004 — Known custom contact property

Expected: accept.

## META-005 — Known event property

Expected: accept.

## META-006 — Unknown event property

Expected: reject.

## META-007 — Event property wrong casing

Expected: reject.

## META-008 — Event property without configured fallback

The docs require fallback configuration. Validate that workflow publishing fails or reports the omission.

## META-009 — Event property with configured fallback

Expected: accept.

## META-010 — Event property repeated many times with one fallback

Expected: accept without duplicate fallback requirements.

## META-011 — Fallback supplied for unused event property

Determine whether ignored, warned, or accepted.

## META-012 — Known transactional data variable

Expected: accept.

## META-013 — Unknown transactional data variable

Expected: reject.

## META-014 — Data variable wrong casing

Expected: reject as unknown.

## META-015 — Required data variable used and declared

Expected: accept.

## META-016 — Required data variable omitted from send payload

Integration validation should fail.

## META-017 — Optional data variable omitted

Expected: send validation succeeds.

## META-018 — Optional data variable sent as empty string

Expected: succeeds.

## META-019 — Optional data variable sent as `null`

Expected: reject.

## META-020 — Data variable sent as string

Expected: accept.

## META-021 — Data variable sent as number

Expected: accept.

## META-022 — Data variable sent as boolean

Expected: reject.

## META-023 — Data variable sent as object

Expected: reject.

## META-024 — Data variable sent as array

Expected: reject.

## META-025 — Extra unused data variable in payload

Determine whether accepted.

## META-026 — Variable used only in hidden section

Verify requiredness is evaluated according to actual rendering behavior.

## META-027 — Variable with incompatible condition operator type

Expected: reject.

---

# 30. Invalid fallback syntax

LMX explicitly does not support inline fallback syntax.

## FALLBACK-001 — Pipe fallback

Test `{contact.firstName|there}`.

Expected: reject.

## FALLBACK-002 — Event pipe fallback

Expected: reject.

## FALLBACK-003 — Colon fallback

Expected: reject.

## FALLBACK-004 — Nullish-coalescing fallback

Expected: reject.

## FALLBACK-005 — Logical-OR fallback

Expected: reject.

## FALLBACK-006 — Comma fallback

Expected: reject.

## FALLBACK-007 — Default function syntax

Expected: reject.

## FALLBACK-008 — `fallback` attribute on block

Expected: reject as unknown.

## FALLBACK-009 — `fallback` attribute on variable-capable tag

Expected: reject.

## FALLBACK-010 — Fallback-looking text inside code block

Expected: literal.

---

# 31. Global structural nesting matrix

Build a generated parent-child compatibility suite rather than relying only on hand-written cases.

## NEST-001 — Every top-level tag at root

Expected according to the documented top-level set.

## NEST-002 — Every child-only tag at root

Expected: reject.

## NEST-003 — Every inline tag at root

Expected: reject.

## NEST-004 — Every block tag inside every inline-content block

Expected: reject.

## NEST-005 — Every inline tag inside every inline-content block

Expected: accept, except button and code-block special cases.

## NEST-006 — Every child-only structural tag inside every unrelated parent

Expected: reject.

## NEST-007 — Every top-level block inside `Section`

Expected: accept except style and section.

## NEST-008 — Every top-level block inside `Component`

Expected: accept except style and component.

## NEST-009 — Every top-level block inside `ColumnItem`

Expected: accept except style and columns.

## NEST-010 — Every tag inside `Columns`

Only `ColumnItem` should pass.

## NEST-011 — Every tag inside list containers

Only `ListItem` should pass.

## NEST-012 — Every tag inside `Icons`

Only `Icon` should pass.

## NEST-013 — Every tag inside `Button`

Only text and variables should pass.

## NEST-014 — Every tag inside `CodeBlock`

No semantic child tags should pass.

## NEST-015 — Every tag inside `Image`, `Divider`, `Br`, `Icon`, and `Style`

All children should fail.

## NEST-016 — Indirect forbidden component nesting

Generate component descendants through every container path.

## NEST-017 — Indirect forbidden section nesting

Generate section descendants through every container path.

## NEST-018 — Indirect forbidden columns nesting

Generate nested columns through sections, components, and other blocks inside a column item.

## NEST-019 — Maximum valid mixed nesting

For example:

- Section

  - Component

    - Columns

      - ColumnItem

        - OrderedList

          - ListItem

            - Strong

              - Em

But note that component/section ancestry rules may invalidate some combinations. Construct the deepest genuinely valid tree.

## NEST-020 — One invalid node deep inside an otherwise valid document

Expected: precise source path and no incorrect blame on ancestors.

---

# 32. Unknown and unsupported attributes

For every tag, programmatically generate tests.

## ATTR-001 — Each documented attribute is accepted on its documented tag

One test per tag-attribute pair.

## ATTR-002 — Each documented attribute is rejected on every unrelated tag

This creates a broad cross-product suite.

## ATTR-003 — Completely unknown attribute

Expected: reject.

## ATTR-004 — Attribute with one-character typo

Expected: reject.

## ATTR-005 — Attribute with wrong casing

Expected: reject.

## ATTR-006 — Attribute prefixed with `data-`

Expected: reject.

## ATTR-007 — Attribute prefixed with `aria-`

Expected: reject.

## ATTR-008 — XML namespace attribute

Expected: reject or ignore only where XML machinery requires it.

## ATTR-009 — Attribute containing colon

Expected: reject.

## ATTR-010 — Duplicate semantic attributes with different casing

Expected: reject both or reject the unsupported casing.

## ATTR-011 — Attributes in random order

Expected: identical semantic output.

## ATTR-012 — Hundreds of unknown attributes

Expected: reject without quadratic behavior.

---

# 33. Value-type validation

## TYPE-001 — Numbers represented as quoted strings

Expected: accept.

## TYPE-002 — Actual unquoted numeric literal

Expected: XML rejection.

## TYPE-003 — Booleans represented as `"true"`

Expected: accept.

## TYPE-004 — Booleans represented as `"false"`

Expected: accept if supported.

## TYPE-005 — Capitalized boolean

Expected: reject.

## TYPE-006 — Numeric boolean

Expected: reject.

## TYPE-007 — Empty boolean

Expected: reject.

## TYPE-008 — Integer numeric value

Expected: accept.

## TYPE-009 — Positive signed number

Test `"+16"`.

Determine behavior.

## TYPE-010 — Negative number

Reject where range excludes negatives.

## TYPE-011 — Decimal number

Define globally whether `number` includes decimals.

## TYPE-012 — Leading decimal point

Test `".5"`.

Determine behavior.

## TYPE-013 — Trailing decimal point

Test `"5."`.

Determine behavior.

## TYPE-014 — Leading zero

Test `"016"`.

Ensure no octal interpretation.

## TYPE-015 — Scientific notation

Determine behavior.

## TYPE-016 — Hexadecimal numeric syntax

Expected: reject.

## TYPE-017 — Locale decimal comma

Expected: reject.

## TYPE-018 — Thousands separator

Expected: reject.

## TYPE-019 — `NaN`

Expected: reject.

## TYPE-020 — Infinity

Expected: reject.

## TYPE-021 — Extremely long numeric string

Expected: reject efficiently.

## TYPE-022 — Numeric overflow

Expected: reject rather than wrap.

---

# 34. URL validation

Apply relevant cases to `Button href`, `Link href`, `Image href`, `Section href`, `Icon href`, `Image src`, and `Image dynamicSrc`, accounting for each field’s special rules.

## URL-001 — Valid HTTPS URL

Expected: accept.

## URL-002 — Valid HTTP URL

Determine whether accepted.

## URL-003 — URL with path

Expected: accept.

## URL-004 — URL with query parameters

Expected: accept with XML-escaped ampersands.

## URL-005 — URL with fragment

Expected: accept.

## URL-006 — Internationalized domain

Determine support.

## URL-007 — Punycode domain

Determine support.

## URL-008 — IPv4 host

Determine support.

## URL-009 — IPv6 host

Determine support.

## URL-010 — Localhost

Determine whether parser-level URL validation permits it.

## URL-011 — Relative path

Determine behavior.

## URL-012 — Protocol-relative URL

Determine behavior.

## URL-013 — Empty URL

Expected: reject where semantically required.

## URL-014 — Whitespace-only URL

Expected: reject.

## URL-015 — Leading/trailing whitespace

Prefer reject rather than silently trim.

## URL-016 — Internal whitespace

Expected: reject.

## URL-017 — Malformed percent encoding

Expected: reject.

## URL-018 — Unicode path

Expected: accept if URL parser supports it.

## URL-019 — `javascript:` scheme

Expected: reject.

## URL-020 — `data:` scheme

Expected: reject.

## URL-021 — `file:` scheme

Expected: reject.

## URL-022 — Embedded credentials

Prefer reject.

## URL-023 — Newline injection

Expected: reject.

## URL-024 — Tab injection

Expected: reject.

## URL-025 — Null-byte injection

Expected: reject.

## URL-026 — HTML entity in query

Expected: decode correctly.

## URL-027 — Variable in hostname

Determine whether dynamic URLs may vary the hostname.

## URL-028 — Variable in scheme

Prefer reject.

## URL-029 — Variable splitting syntactic URL delimiters

Expected: reject if the static template cannot be validated safely.

## URL-030 — Several variables in path/query

Expected: accept where dynamic URLs are supported.

---

# 35. Hex-color validation

Apply to every color attribute.

## COLOR-001 — Six-digit lowercase hex

Expected: accept.

## COLOR-002 — Six-digit uppercase hex

Expected: accept.

## COLOR-003 — Mixed-case hex

Expected: accept.

## COLOR-004 — Three-digit shorthand

Determine support.

## COLOR-005 — Four-digit shorthand with alpha

Determine support.

## COLOR-006 — Eight-digit alpha hex

Determine support.

## COLOR-007 — Missing hash

Expected: reject.

## COLOR-008 — Too few digits

Expected: reject.

## COLOR-009 — Too many digits

Expected: reject.

## COLOR-010 — Invalid character

Expected: reject.

## COLOR-011 — Empty string

Expected: reject.

## COLOR-012 — Surrounding whitespace

Prefer reject or normalize consistently.

## COLOR-013 — Named CSS color

Expected: reject.

## COLOR-014 — RGB function

Expected: reject.

## COLOR-015 — Variable reference

Expected: reject.

---

# 36. Error aggregation and diagnostics

## ERR-001 — Single XML syntax error

Return a syntax category and precise location.

## ERR-002 — Single unknown tag

Return semantic category and tag location.

## ERR-003 — Single unknown attribute

Identify the attribute, not merely its tag.

## ERR-004 — Missing required attribute

Identify the tag and required attribute name.

## ERR-005 — Invalid attribute value

Include expected type or allowed values.

## ERR-006 — Invalid nesting

Identify both child and required/actual parent.

## ERR-007 — Invalid variable prefix

Point to the variable span.

## ERR-008 — Invalid variable placement

Point to the exact attribute or text node.

## ERR-009 — Several independent semantic errors

Verify all are reported when multi-error validation is supported.

## ERR-010 — Parent error plus child error

Avoid duplicate noise where one structural error makes child validation meaningless.

## ERR-011 — Unknown tag with unknown attributes

Define whether only the unknown-tag issue or both issues are emitted.

## ERR-012 — Syntax error early in document

Do not return misleading semantic errors from corrupt recovery state.

## ERR-013 — Syntax error late in document

Preserve earlier valid source locations if partial parsing is exposed.

## ERR-014 — Line and column with LF input

Expected: exact.

## ERR-015 — Line and column with CRLF input

Expected: exact.

## ERR-016 — Unicode before error location

Column calculation must use the documented indexing model: bytes, code units, or Unicode scalar values. Lock it down.

## ERR-017 — Emoji before error location

Same verification.

## ERR-018 — Source excerpt generation

Do not break surrogate pairs or expose enormous input.

## ERR-019 — Stable error code

Every validation class should have a machine-readable code.

## ERR-020 — Stable issue ordering

Issue order must be deterministic.

## ERR-021 — No internal exception leakage

Malformed user input returns domain errors, not raw parser exceptions.

## ERR-022 — Duplicate error elimination

The same invalid construct should not emit identical issues repeatedly.

## ERR-023 — Error path through containers

Return a useful path such as `Section[0] > Columns[1] > ColumnItem[2] > Paragraph[0]`.

## ERR-024 — Unsupported dynamic attribute code

Verify image `src` produces the expected dedicated issue class.

---

# 37. AST integrity

Adapt these to the parser’s actual AST schema.

## AST-001 — Document node shape

Expected fields are always present and correctly typed.

## AST-002 — Tag discriminators

Every recognized tag maps to the correct node type.

## AST-003 — Self-closing elements

Map consistently without invented text children.

## AST-004 — Text node ordering

Text and inline elements remain interleaved correctly.

## AST-005 — Variable node representation

Prefix and property name are separated or retained consistently.

## AST-006 — Attribute values remain strings

Do not accidentally coerce values unless the AST contract explicitly uses typed values.

## AST-007 — Typed attribute representation

When coercion is intended, verify valid numbers and booleans become the right type and raw values remain available if needed.

## AST-008 — Source spans

Every node has accurate start and end offsets.

## AST-009 — Attribute source spans

Every attribute has accurate source metadata.

## AST-010 — Text source spans after entity decoding

Define whether spans refer to source text or decoded text.

## AST-011 — No shared mutable child arrays

Mutating one parsed tree must not affect another parse.

## AST-012 — No prototype pollution

Attributes named like `__proto__`, `constructor`, or `prototype` must not modify object prototypes.

## AST-013 — Null-prototype maps where appropriate

Verify safe attribute storage.

## AST-014 — Input immutability

Parsing must not alter the supplied string or byte buffer.

## AST-015 — Deterministic output

Same input and options produce deeply equal output.

## AST-016 — Attribute order independence

Semantically equal documents with reordered attributes produce equivalent ASTs.

## AST-017 — Whitespace-equivalent input

Pretty-printed and compact documents produce equivalent semantic trees outside code blocks.

## AST-018 — Code-block distinction

Whitespace-different code blocks must not produce equivalent content nodes.

## AST-019 — Unknown nodes never leak into successful AST

Validation success implies all nodes are supported.

## AST-020 — No partial AST marked valid

An error result must never be mistaken for a fully valid document.

---

# 38. Serialization and round trips

When the parser has a serializer or formatter:

## ROUND-001 — Parse → serialize → parse

Resulting ASTs should be semantically equivalent.

## ROUND-002 — Every tag round trip

Test all documented tags.

## ROUND-003 — Every attribute round trip

Test all documented attributes.

## ROUND-004 — Entity round trip

Decoded special characters must be correctly re-escaped.

## ROUND-005 — Quote round trip

Attribute quotes must remain valid XML.

## ROUND-006 — Variable round trip

Variables must not be escaped or altered.

## ROUND-007 — Code-block whitespace round trip

Must remain exact, subject only to an explicitly documented newline policy.

## ROUND-008 — Inline whitespace round trip

Semantic whitespace must be preserved.

## ROUND-009 — Self-closing syntax round trip

Self-closing tags serialize using valid `/>` syntax.

## ROUND-010 — Empty normal element round trip

Preserve or normalize consistently.

## ROUND-011 — Attribute ordering

Serializer ordering should be deterministic.

## ROUND-012 — Formatting idempotence

Formatting an already formatted document should produce identical output.

## ROUND-013 — Comments

If supported, verify preservation or intentional removal.

## ROUND-014 — BOM and XML declaration

Verify chosen policy remains stable.

---

# 39. Security hardening

## SEC-001 — External entity expansion

Use an XXE payload.

Expected: external entities are never loaded.

## SEC-002 — Local-file entity

Expected: no file access.

## SEC-003 — Network entity

Expected: no network access.

## SEC-004 — Billion-laughs payload

Expected: reject without exponential expansion.

## SEC-005 — Deep entity nesting

Expected: reject safely.

## SEC-006 — Deep tag nesting

Apply a configurable maximum nesting depth.

## SEC-007 — Huge attribute count

Apply a safe limit.

## SEC-008 — Huge single attribute value

Apply a safe limit or process linearly.

## SEC-009 — Huge single text node

Process without quadratic copying.

## SEC-010 — Huge number of sibling tags

Process linearly within configured bounds.

## SEC-011 — Very long tag name

Reject safely.

## SEC-012 — Very long attribute name

Reject safely.

## SEC-013 — Very long variable name

Reject safely.

## SEC-014 — Prototype-pollution attribute names

No prototype mutation.

## SEC-015 — Constructor-like tag names

No dynamic constructor lookup based directly on user input.

## SEC-016 — Regex denial of service in variable parsing

Use long runs of braces, dots, and invalid characters.

Expected: linear or bounded behavior.

## SEC-017 — Regex denial of service in URL parsing

Use adversarial URL strings.

## SEC-018 — Regex denial of service in numeric parsing

Use enormous signs, decimal points, and exponent strings.

## SEC-019 — Unicode normalization confusion

Visually similar tag and attribute names must not bypass exact matching.

## SEC-020 — Null-character injection in attributes

Expected: reject.

## SEC-021 — Newline injection in URLs

Expected: reject.

## SEC-022 — Script content in text

Plain script text is allowed as text, but actual HTML tags remain unknown and rejected.

## SEC-023 — JavaScript URL in link-capable attributes

Expected: reject.

## SEC-024 — Malicious image URL hostname suffix

Expected: Loops-host validation cannot be fooled by suffix matching.

## SEC-025 — Malicious username portion

For example `https://images.vialoops.com@attacker.example/image.png`.

Expected: reject as external.

---

# 40. Performance and resource limits

## PERF-001 — Typical campaign document

Record baseline parse time.

## PERF-002 — Full documented campaign example

Expected: fast successful parse.

## PERF-003 — Ten-times typical size

Expected: approximately linear scaling.

## PERF-004 — Thousands of paragraphs

Expected: linear scaling.

## PERF-005 — Thousands of inline nodes

Expected: linear scaling.

## PERF-006 — Thousands of variables

Expected: linear scaling.

## PERF-007 — Maximum icons

Expected: no unusual slowdown.

## PERF-008 — Oversized icons container

Reject before expensive downstream work.

## PERF-009 — Deeply nested inline tags under limit

Expected: succeed.

## PERF-010 — Nesting one level over limit

Expected: fail cleanly.

## PERF-011 — Huge code block

Expected: preserve content without repeated copying.

## PERF-012 — Huge malformed document

Expected: bounded failure time.

## PERF-013 — Missing closing tag after megabytes of text

Expected: no catastrophic behavior.

## PERF-014 — Many repeated invalid attributes

Expected: bounded issue count or controlled reporting.

## PERF-015 — Concurrent parsing

Parse many independent documents simultaneously.

Expected: no shared state or cross-request contamination.

## PERF-016 — Repeated parsing loop

Check memory does not continuously grow.

## PERF-017 — Aborted parse

If cancellation is supported, verify resources are released.

---

# 41. Fuzz and property-based testing

## FUZZ-001 — Valid document generator

Generate arbitrary valid ASTs from the grammar, serialize them, parse them, and verify semantic equality.

## FUZZ-002 — Single-mutation invalid documents

Take valid documents and mutate exactly one property:

- tag casing;
- missing attribute;
- unknown attribute;
- invalid parent;
- bad numeric value;
- invalid variable;
- wrong self-closing form.

Expected: rejection attributable to the mutation.

## FUZZ-003 — Random tag substitution

Replace a valid child with every other tag and compare against the nesting matrix.

## FUZZ-004 — Random attribute substitution

Move valid attributes onto invalid tags.

## FUZZ-005 — Random attribute-value mutation

Mutate valid numbers, booleans, colors, URLs, identifiers, and enumerations.

## FUZZ-006 — Random brace insertion

Insert `{` and `}` throughout text and attributes.

Expected: no crashes or hangs.

## FUZZ-007 — Random XML punctuation insertion

Insert `<`, `>`, `/`, `=`, quotes, and ampersands.

## FUZZ-008 — Random Unicode input

Include combining marks, RTL controls, emoji, and noncharacters.

## FUZZ-009 — Truncation fuzzing

Truncate valid documents at every byte offset.

Every result must either parse validly where truncation remains valid or return a controlled error.

## FUZZ-010 — Prefix fuzzing

Parse every prefix of each canonical example.

## FUZZ-011 — Suffix fuzzing

Remove every possible leading segment.

## FUZZ-012 — Byte mutation

Flip individual bytes in valid UTF-8 documents.

## FUZZ-013 — Differential XML parsing

Compare low-level XML syntax results against a trusted XML parser while retaining LMX-specific semantic differences.

## FUZZ-014 — Round-trip property

For every generated valid AST:

```text
parse(serialize(ast)) ≡ ast
```

## FUZZ-015 — Formatting idempotence property

```text
format(format(source)) === format(source)
```

## FUZZ-016 — Determinism property

```text
parse(source) === parse(source)
```

## FUZZ-017 — Whitespace equivalence property

For non-code content, inserting structural formatting whitespace should not change semantics.

## FUZZ-018 — Code whitespace sensitivity property

Changing code-block interior whitespace should change code-block content.

## FUZZ-019 — Invalid documents never throw unexpected errors

Any arbitrary string must return either success or a documented parser error type.

## FUZZ-020 — Runtime limits

Every fuzz case must have time and memory limits.

---

# 42. Canonical examples from the documentation

Each documentation example should become a permanent fixture.

## EXAMPLE-001 — Basic heading and paragraph

Expected: accept.

## EXAMPLE-002 — Ordered release checklist

Expected: accept.

## EXAMPLE-003 — Two-column pricing layout

Expected: accept.

## EXAMPLE-004 — Full campaign example

Expected: accept in campaign context.

## EXAMPLE-005 — Workflow email example

Expected: accept in workflow context.

## EXAMPLE-006 — Transactional reset-password example

Expected: accept in transactional context.

## EXAMPLE-007 — Heading styling example

Expected: accept.

## EXAMPLE-008 — Paragraph styling example

Expected: accept.

## EXAMPLE-009 — Quote styling example

Expected: accept.

## EXAMPLE-010 — Code block example

Expected: accept with literal code.

## EXAMPLE-011 — Buttons example

Expected: accept in the appropriate contexts.

## EXAMPLE-012 — Static image example

Expected: accept.

## EXAMPLE-013 — Dynamic image example

Expected: accept with a static placeholder and dynamic source.

## EXAMPLE-014 — Divider example

Expected: accept.

## EXAMPLE-015 — Explicit line-break example

Expected: accept.

## EXAMPLE-016 — Ordered and unordered list example

Expected: accept.

## EXAMPLE-017 — Styled list-item example

Expected: accept.

## EXAMPLE-018 — Columns example

Expected: accept.

## EXAMPLE-019 — Three-column example

Expected: accept.

## EXAMPLE-020 — Self-closing component example

Expected: accept.

## EXAMPLE-021 — Component override example

Expected: accept.

## EXAMPLE-022 — Clickable section example

Expected: accept.

## EXAMPLE-023 — Conditional section example

Expected: accept.

## EXAMPLE-024 — Icons example

Expected: accept.

## EXAMPLE-025 — Inline formatting example

Expected: accept.

## EXAMPLE-026 — Contact variable example

Expected: accept in campaign/workflow context.

## EXAMPLE-027 — Event property example

Expected: accept in workflow context.

## EXAMPLE-028 — Data-variable example

Expected: accept in transactional context.

---

# 43. Mutation tests for every canonical example

For each fixture above, produce at least these mutations.

## MUT-001 — Lowercase one tag

Expected: reject.

## MUT-002 — Remove one required attribute

Expected: reject where applicable.

## MUT-003 — Add one unknown attribute

Expected: reject.

## MUT-004 — Move one child to an invalid parent

Expected: reject.

## MUT-005 — Replace one numeric value with text

Expected: reject.

## MUT-006 — Replace one enum with an unknown value

Expected: reject.

## MUT-007 — Replace one hex color with an invalid color

Expected: reject.

## MUT-008 — Replace one valid variable with an unprefixed variable

Expected: reject.

## MUT-009 — Replace one valid variable with editor syntax

Expected: reject.

## MUT-010 — Insert top-level text

Expected: reject.

## MUT-011 — Break one closing tag

Expected: syntax rejection.

## MUT-012 — Remove one self-closing slash

Expected: syntax or LMX rejection.

## MUT-013 — Duplicate the style tag

Expected: reject.

## MUT-014 — Introduce a nested section

Expected: reject.

## MUT-015 — Introduce nested columns

Expected: reject.

## MUT-016 — Introduce nested component

Expected: reject.

---

# 44. Parser API behavior

## API-001 — Parse valid string

Returns successful typed result.

## API-002 — Parse invalid string

Returns the documented typed error result.

## API-003 — `null` input

Typed languages should reject at compile time; runtime JavaScript callers should receive a controlled input error.

## API-004 — `undefined` input

Same requirement.

## API-005 — Number input

Controlled input-type error.

## API-006 — Object input

Controlled input-type error.

## API-007 — Buffer input

Accept only if documented.

## API-008 — Empty options object

Equivalent to defaults.

## API-009 — Invalid message-context option

Controlled configuration error.

## API-010 — Missing metadata provider

Behavior is explicit when contextual validation is requested.

## API-011 — Metadata provider failure

Return a typed dependency error, not a misleading LMX syntax error.

## API-012 — Metadata provider timeout

Handle according to the validation API contract.

## API-013 — Caller cancellation

Abort cleanly when supported.

## API-014 — Parser instance reuse

No state from one document leaks into another.

## API-015 — Parallel instance use

No race conditions.

## API-016 — Read-only result contract

If ASTs are meant to be immutable, verify freezing or defensive behavior.

---

# 45. Ambiguities that should be explicitly decided

The documentation does not fully determine these. The test suite should encode your chosen contract rather than leave accidental behavior.

## DECISION-001 — Are empty LMX documents valid?

## DECISION-002 — Is a style-only document valid?

## DECISION-003 — Must `<Style />` appear before all content?

## DECISION-004 — Are XML declarations accepted?

## DECISION-005 — Are XML comments accepted, preserved, or discarded?

## DECISION-006 — Is CDATA accepted?

## DECISION-007 — Are explicitly closed self-closing tags rejected?

For example `<Divider></Divider>`.

## DECISION-008 — Are self-closed empty normal blocks accepted?

For example `<Paragraph />`.

## DECISION-009 — Are empty headings, paragraphs, quotes, buttons, sections, columns, and component overrides valid?

## DECISION-010 — Are numeric values integers only?

## DECISION-011 — Are decimal values accepted for percentages and pixel values?

## DECISION-012 — Are negative values universally rejected or validated per field?

## DECISION-013 — Are numeric values trimmed?

## DECISION-014 — Which hex forms are supported?

## DECISION-015 — Which URL schemes are supported?

## DECISION-016 — Must non-image URLs be absolute?

## DECISION-017 — Is HTTP accepted or only HTTPS?

## DECISION-018 — Are `mailto:` and `tel:` accepted?

## DECISION-019 — Which image extensions are accepted?

## DECISION-020 — Is a static external URL accepted in `dynamicSrc` without a variable?

## DECISION-021 — Can dynamic URL templates vary the hostname?

## DECISION-022 — What identifier grammar applies to contact and event property names?

## DECISION-023 — Are Unicode variable names allowed?

## DECISION-024 — Can variables contain nested property paths?

## DECISION-025 — How are literal braces represented in ordinary text?

## DECISION-026 — Are unknown contact properties parser errors, warnings, or send-time errors?

## DECISION-027 — Are unmatched border width/color pairs accepted but ignored, warned about, or rejected?

## DECISION-028 — Are comments permitted between child-only elements?

## DECISION-029 — Does “nested section/component/columns” forbid indirect descendant nesting as well as direct children?

It should.

## DECISION-030 — Is `ifValue` retained when the operation ignores it?

## DECISION-031 — Is an unsupported `ifOperation` ignored when no `if` exists, or rejected?

## DECISION-032 — What is the maximum input length?

## DECISION-033 — What is the maximum nesting depth?

## DECISION-034 — What is the maximum text-node length?

## DECISION-035 — What is the maximum number of validation issues returned?

---

# 46. Recommended generated test matrices

Manually writing every cross-product test is error-prone. Generate these from a declarative grammar definition.

## MATRIX-001 — Tag versus root validity

Rows: every known tag.
Column: valid or invalid at root.

## MATRIX-002 — Parent versus child validity

Rows: every possible parent.
Columns: every known tag plus plain text and variables.

## MATRIX-003 — Tag versus attribute validity

Rows: every tag.
Columns: every documented attribute.

## MATRIX-004 — Attribute versus value class

For each attribute, test:

- valid representative;
- lower boundary;
- upper boundary;
- just below lower boundary;
- just above upper boundary;
- empty;
- whitespace;
- malformed;
- variable-containing value;
- extremely long value.

## MATRIX-005 — Variable prefix versus message type

| Prefix    | Campaign | Workflow | Transactional |
| --------- | -------: | -------: | ------------: |
| `contact` |    valid |    valid |       invalid |
| `event`   |  invalid |    valid |       invalid |
| `data`    |  invalid |  invalid |         valid |

## MATRIX-006 — Variable location versus support

Rows: every text and attribute location.
Columns: contact, event, data, malformed, unprefixed.

## MATRIX-007 — Conditional operator versus variable type

Rows: all operators.
Columns: text, number, boolean, transactional data text.

## MATRIX-008 — Container child counts

Test below minimum, minimum, ordinary valid count, maximum, and maximum plus one.

## MATRIX-009 — Numeric boundaries

For every numeric field, define and test an explicit domain.

## MATRIX-010 — Canonical fixture mutations

Automatically apply the mutation suite to every documentation fixture.

---

# 47. Integration-level validation

These are not strictly parser tests, but omitting them undermines the desired runtime confidence.

## INT-001 — Parsed AST passes the actual renderer

Every valid canonical fixture should render without throwing.

## INT-002 — Renderer rejects no parser-approved node

The parser and renderer must share the same grammar version.

## INT-003 — Parser rejects no renderer-supported documented node

Catch drift in the opposite direction.

## INT-004 — Campaign example sent through API validation

Use a non-production test account or API mock.

## INT-005 — Workflow example with event fallbacks

Verify fallback metadata is transmitted correctly.

## INT-006 — Transactional example with required data

Verify send-time data validation.

## INT-007 — Optional data variable omitted

Verify the complete flow succeeds.

## INT-008 — Dynamic image resolution

Verify `dynamicSrc` replaces the placeholder source at send/render time.

## INT-009 — Missing dynamic image value

Verify actual fallback/placeholder behavior.

## INT-010 — Hidden conditional section

Verify its children and variables are removed.

## INT-011 — Link tracking disabled

Verify `notrack="true"` is propagated.

## INT-012 — Component lookup

Known IDs resolve; unknown IDs fail predictably.

## INT-013 — Theme lookup

Known theme IDs resolve; unknown IDs fail predictably.

## INT-014 — Serializer output accepted by Loops

Golden integration test against the Content API or its official validator.

## INT-015 — LMX retrieved from Loops can be parsed

Use representative real exported LMX fixtures.

## INT-016 — Parse, edit AST, serialize, update, retrieve, and parse again

Verify semantic stability across the full round trip.

---

# 48. Regression-test policy

Every production parser defect should result in:

1. the smallest possible fixture reproducing it;
2. a test for the exact original input;
3. a generalized test covering the defect class;
4. a mutation/property test where feasible;
5. a renderer or API integration test when the defect crossed system boundaries.

Keep fixture categories separate:

- documented valid;
- documented invalid;
- implementation-defined valid;
- implementation-defined invalid;
- regression fixtures;
- adversarial/security fixtures;
- real-world exported fixtures.

Do not silently change an implementation-defined expectation. Such a change should require an explicit grammar-version or compatibility decision.

---

# 49. Suggested acceptance gates

A parser release should not ship unless:

- every documented example passes;
- every tag and attribute has positive coverage;
- every nesting rule has positive and negative coverage;
- every required attribute has missing-value coverage;
- every enum has all valid values and at least two invalid values covered;
- every numeric attribute has boundary coverage;
- every dynamic attribute has valid and invalid variable coverage;
- every forbidden dynamic attribute has rejection coverage;
- all three message contexts have cross-prefix coverage;
- parser/serializer round trips pass;
- parser/renderer compatibility tests pass;
- fuzzing has found no unexpected exception, hang, or memory explosion;
- XXE and entity-expansion tests pass;
- mutation testing demonstrates the validation tests actually detect removed checks;
- error codes and source positions are snapshot-tested;
- representative real Loops exports pass;
- performance remains within an agreed regression threshold.

---

# 50. Highest-risk scenarios

Prioritize these before the long-tail cases:

1. Top-level fragment parsing without an artificial XML root.
2. Complete parent-child nesting matrix.
3. Inline content versus block content separation.
4. Button’s special prohibition against inline tags.
5. Code-block literal variable handling and whitespace preservation.
6. Required static Loops-hosted image `src`.
7. Dynamic attributes allowed only in explicitly supported locations.
8. Message-type restrictions for contact, event, and data variables.
9. Conditional operator/value rules.
10. Indirect nested section, component, and columns detection.
11. Column count and width-count/total consistency.
12. Icons count boundaries.
13. Unknown attribute rejection.
14. XML entity and XXE hardening.
15. Deep nesting and oversized-input limits.
16. Parser/serializer/renderer grammar drift.
