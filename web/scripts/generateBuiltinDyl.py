import hashlib
import html
import json
import re
import sqlite3
import zipfile
from pathlib import Path

ROOT = Path.cwd()
DOWNLOADS = Path.home() / "Downloads"
APKG = next(path for path in DOWNLOADS.iterdir() if path.suffix.lower() == ".apkg" and "DYL" in path.name)
PACK_ID = "dyl-exam"
PACK_TITLE = "【DYL】考试分析重新排版"
MEDIA_DIR = ROOT / "public" / "bundles" / PACK_ID / "media"
CARD_CHUNK_SIZE = 25
FIELD_SEPARATOR = "\x1f"
MAX_SIDE_HTML_LENGTH = 120000
MAX_CARD_CSS_LENGTH = 10000

ANSWER_PATTERNS = [
    re.compile(r"(?:[【［\[]\s*)?(?:参考答案|参考解析|答案解析|解析答案|参考解答)(?:\s*[】］\]])?\s*[:：]?", re.I),
    re.compile(r"(?:^|[\n\r])\s*(?:答案|解析)\s*[:：]", re.I),
    re.compile(r"[【［\[]\s*(?:答案|解析)\s*[】］\]]\s*[:：]?", re.I),
]
SCRIPT_CALL_RE = re.compile(r"^(?:decrypt|render|show|load|init)[a-zA-Z0-9_$]*\(\)$", re.I)
MAJOR_RE = re.compile(r"^[A-Z]\s*[\u4e00-\u9fff].*学$")
UNSAFE_BLOCKS = [
    r"<script\b[^>]*>[\s\S]*?</script>",
    r"<noscript\b[^>]*>[\s\S]*?</noscript>",
    r"<audio\b[^>]*>[\s\S]*?</audio>",
    r"<video\b[^>]*>[\s\S]*?</video>",
]


def normalize_text(value=""):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def split_path(name=""):
    return [normalize_text(part) for part in str(name or "").split("::") if normalize_text(part)]


def strip_unsafe(markup="", keep_img=True):
    output = str(markup or "")
    for pattern in UNSAFE_BLOCKS:
        output = re.sub(pattern, "", output, flags=re.I)
    output = re.sub(r"<!doctype[^>]*>", "", output, flags=re.I)
    output = re.sub(r"<head\b[^>]*>[\s\S]*?</head>", "", output, flags=re.I)
    output = re.sub(r"</?(?:template|html|body)\b[^>]*>", "", output, flags=re.I)
    output = re.sub(r"<source\b[^>]*>", "", output, flags=re.I)
    if not keep_img:
        output = re.sub(r"<img\b[^>]*>", "", output, flags=re.I)
    output = re.sub(r"\[sound:[^\]]+\]", "", output, flags=re.I)
    output = re.sub(r"\son[a-z]+\s*=\s*([\"']).*?\1", "", output, flags=re.I | re.S)
    output = re.sub(r"\son[a-z]+\s*=\s*[^\s>]+", "", output, flags=re.I)
    output = re.sub(r"url\((?:\"[^\"]*\"|'[^']*'|[^)]*)\)", "none", output, flags=re.I)
    return output


def strip_tags(markup=""):
    safe = strip_unsafe(markup, keep_img=False)
    safe = re.sub(r"<br\s*/?>", "\n", safe, flags=re.I)
    safe = re.sub(r"</(?:p|div|section|article|li|tr|h[1-6])>", "\n", safe, flags=re.I)
    safe = re.sub(r"<[^>]+>", " ", safe)
    return normalize_text(html.unescape(safe))


def remove_known_prefix_text(text="", prefix=""):
    clean_text = normalize_text(text)
    clean_prefix = normalize_text(prefix)
    if not clean_text or not clean_prefix:
        return clean_text
    if clean_text == clean_prefix:
        return ""
    if clean_text.startswith(clean_prefix):
        return clean_text[len(clean_prefix):].strip()

    limit = min(len(clean_text), len(clean_prefix))
    index = 0
    while index < limit and clean_text[index] == clean_prefix[index]:
        index += 1
    if index >= 80 and index / max(1, len(clean_prefix)) >= 0.65:
        return clean_text[index:].strip()
    return clean_text


def get_field(fields, *names):
    lookup = {str(key).casefold(): value for key, value in fields.items()}
    for name in names:
        value = lookup.get(str(name).casefold())
        if value is not None and strip_tags(value):
            return value
    return ""


def clean_html_fragment(markup=""):
    return strip_unsafe(markup, keep_img=True).strip()


def find_answer_index(text=""):
    for pattern in ANSWER_PATTERNS:
        match = pattern.search(text or "")
        if match:
            return match.start()
    return -1


def strip_answer_text(text=""):
    index = find_answer_index(text)
    return text[:index].strip() if index >= 0 else text


def strip_answer_html(markup=""):
    index = find_answer_index(markup or "")
    return (markup[:index].strip() if index >= 0 else markup).strip()


def process_conditionals(template, fields):
    output = str(template or "")
    for _ in range(6):
        previous = output
        output = re.sub(
            r"{{#([^}]+)}}([\s\S]*?){{/\1}}",
            lambda match: match.group(2) if str(fields.get(match.group(1).strip(), "")).strip() else "",
            output,
        )
        output = re.sub(
            r"{{\^([^}]+)}}([\s\S]*?){{/\1}}",
            lambda match: "" if str(fields.get(match.group(1).strip(), "")).strip() else match.group(2),
            output,
        )
        if output == previous:
            break
    return output


def render_cloze(value, cloze_index, revealed):
    def replace(match):
        index = int(match.group(1))
        text = match.group(2)
        hint = match.group(3) or "..."
        if index != cloze_index:
            return text
        if revealed:
            return f'<span class="anki-cloze anki-cloze-revealed">{text}</span>'
        return f'<span class="anki-cloze">{hint}</span>'

    return re.sub(r"{{c(\d+)::(.*?)(?:::(.*?))?}}", replace, str(value or ""))


def render_template(template, fields, tags, deck_name, template_name, front_side="", cloze_index=1, revealed=False):
    output = process_conditionals(template, fields)
    output = output.replace("{{FrontSide}}", front_side)
    output = output.replace("{{Tags}}", " ".join(tags))
    output = output.replace("{{Deck}}", deck_name)
    output = output.replace("{{Card}}", template_name)
    output = re.sub(
        r"{{cloze:([^}]+)}}",
        lambda match: render_cloze(fields.get(match.group(1).strip(), ""), cloze_index, revealed),
        output,
    )

    def replace_field(match):
        name = match.group(1).strip()
        if name.startswith(("#", "/", "^")) or re.match(r"^tts\b", name, re.I):
            return ""
        field_name = name.split(":")[-1].strip() if ":" in name else name
        return str(fields.get(field_name, ""))

    output = re.sub(r"{{([^}]+)}}", replace_field, output)
    return output.strip()


def looks_rich(markup=""):
    return bool(
        re.search(r"<(?:img|table|ul|ol|strong|em|b|i|ruby|rt|br|div|span|p|section|article|h[1-6]|style)\b", markup or "", re.I)
        or re.search(r"\s(?:class|style)=", markup or "", re.I)
    )


def text_coverage(text="", target=""):
    clean_text = normalize_text(text)
    clean_target = normalize_text(target)
    if not clean_text or not clean_target:
        return 0
    if clean_target in clean_text:
        return 1
    if clean_text in clean_target:
        return len(clean_text) / len(clean_target)

    sample = clean_target[: min(120, len(clean_target))]
    if len(sample) >= 20 and sample in clean_text:
        return len(sample) / len(clean_target)

    index = 0
    limit = min(len(clean_text), len(clean_target))
    while index < limit and clean_text[index] == clean_target[index]:
        index += 1
    return index / len(clean_target)


def html_coverage(markup="", target=""):
    return text_coverage(strip_tags(markup), target)


def is_script_text(value=""):
    text = strip_tags(value)
    return (not text) or bool(SCRIPT_CALL_RE.match(text))


def make_html(markup, fallback):
    safe = strip_unsafe(markup, keep_img=True).strip()
    if not safe or len(safe) > MAX_SIDE_HTML_LENGTH:
        return ""
    text = strip_tags(safe)
    if not text and "<img" not in safe.lower():
        return ""
    if is_script_text(text):
        return ""
    if normalize_text(text) == normalize_text(fallback) and not looks_rich(safe):
        return ""
    return safe


def pick_front_html(template_html, field_html, fallback):
    template_safe = make_html(clean_html_fragment(template_html), fallback)
    field_safe = make_html(clean_html_fragment(field_html), fallback)
    if template_safe and field_safe:
        template_coverage = html_coverage(template_safe, fallback)
        field_coverage = html_coverage(field_safe, fallback)
        if field_coverage > template_coverage + 0.15 or (template_coverage < 0.35 and field_coverage > template_coverage):
            return field_safe
    return template_safe or field_safe


def make_css(css=""):
    output = str(css or "")
    output = re.sub(r"<script\b[^>]*>[\s\S]*?</script>", "", output, flags=re.I)
    output = re.sub(r"@import[^;]+;", "", output, flags=re.I)
    output = re.sub(r"url\((?:\"[^\"]*\"|'[^']*'|[^)]*)\)", "none", output, flags=re.I)
    output = re.sub(r"(?:-webkit-|-moz-|-ms-)?user-select\s*:\s*[^;{}]+;?", "", output, flags=re.I)
    output = re.sub(r"-webkit-touch-callout\s*:\s*[^;{}]+;?", "", output, flags=re.I)
    return output.strip()[:MAX_CARD_CSS_LENGTH]


TAG_RE = re.compile(r"<(/?)([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>", re.I)


def find_matching_tag(markup, open_start, tag_name):
    open_match = TAG_RE.match(markup, open_start)
    if not open_match:
        return open_start, len(markup), len(markup)

    open_end = open_match.end()
    depth = 1
    for match in TAG_RE.finditer(markup, open_end):
        name = match.group(2).lower()
        if name != tag_name.lower():
            continue
        if match.group(1):
            depth -= 1
        elif not match.group(0).rstrip().endswith("/>"):
            depth += 1
        if depth == 0:
            return open_end, match.start(), match.end()
    return open_end, len(markup), len(markup)


def extract_div_inner_by_id(markup, content_id):
    pattern = re.compile(rf"<div\b(?=[^>]*\bid=[\"']{re.escape(content_id)}[\"'])[^>]*>", re.I)
    match = pattern.search(markup or "")
    if not match:
        return ""
    inner_start, inner_end, _ = find_matching_tag(markup, match.start(), "div")
    return markup[inner_start:inner_end]


def extract_toggle_sections(markup=""):
    labels = {}
    for match in re.finditer(r"<button\b[^>]*showContent\((\d+)\)[^>]*>([\s\S]*?)</button>", markup or "", re.I):
        label = strip_tags(match.group(2))
        if label:
            labels[match.group(1)] = label

    sections = []
    for number, label in labels.items():
        inner = extract_div_inner_by_id(markup, f"content{number}")
        html_value = clean_html_fragment(inner)
        text = strip_tags(html_value)
        if html_value and text:
            sections.append({
                "id": f"content-{number}",
                "label": label,
                "html": html_value,
                "text": text,
            })
    return sections


def make_field_sections(fields):
    section_fields = [
        ("analysis", "考试分析原文", ("原文",)),
        ("choice", "选择题", ("选择题",)),
        ("answer", "答案与解析", ("答案与解析", "解析", "答案")),
        ("source-note", "DYL笔记", ("我的笔记",)),
    ]
    sections = []
    for section_id, label, names in section_fields:
        value = get_field(fields, *names)
        html_value = clean_html_fragment(value)
        text = strip_tags(html_value)
        if html_value and text:
            sections.append({
                "id": section_id,
                "label": label,
                "html": html_value,
                "text": text,
            })
    return sections


def render_section_html(section):
    return f'<section class="anki-html-section"><h3>{html.escape(section["label"])}</h3>{section["html"]}</section>'


def render_sections_html(sections):
    return "".join(render_section_html(section) for section in sections)


def stable_id(value):
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def target_for_path(deck_path):
    if not deck_path:
        return PACK_TITLE, "Anki 导入", ""
    root_name = deck_path[0]
    major_index = next((index for index, part in enumerate(deck_path) if MAJOR_RE.match(part)), -1)
    if major_index < 0:
        major_index = 1 if len(deck_path) > 1 and root_name.startswith("【DYL】") else 0
    name = deck_path[major_index] if 0 <= major_index < len(deck_path) else root_name
    chapter = " / ".join(deck_path[major_index + 1:major_index + 3]) if major_index >= 0 else ""
    return PACK_TITLE, name, chapter


def main():
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    for old_file in MEDIA_DIR.iterdir():
        if old_file.is_file():
            old_file.unlink()

    with zipfile.ZipFile(APKG) as zip_file:
        media_map = json.loads(zip_file.read("media").decode("utf-8")) if "media" in zip_file.namelist() else {}
        filename_to_url = {}
        for key, filename in media_map.items():
            if key not in zip_file.namelist():
                continue
            extension = Path(filename).suffix.lower() or ".bin"
            safe_name = f"{key}{extension}"
            (MEDIA_DIR / safe_name).write_bytes(zip_file.read(key))
            filename_to_url[filename] = f"/bundles/{PACK_ID}/media/{safe_name}"

        def rewrite_media(markup=""):
            def replace(match):
                prefix, src, suffix = match.group(1), html.unescape(match.group(2)), match.group(3)
                clean = src.split("/")[-1]
                url = filename_to_url.get(src) or filename_to_url.get(clean)
                return f"{prefix}{url}{suffix}" if url else match.group(0)

            return re.sub(r"(\bsrc\s*=\s*[\"'])([^\"']+)([\"'])", replace, markup or "", flags=re.I)

        def remove_external_images(markup=""):
            return re.sub(r"<img\b[^>]*\bsrc=[\"'](?!/bundles/)[^\"']+[\"'][^>]*>", "", markup or "", flags=re.I)

        collection_name = next(
            name for name in ["collection.anki21", "collection.anki2", "collection.anki21b"] if name in zip_file.namelist()
        )
        temp_db = ROOT / "public" / "bundles" / PACK_ID / "collection.tmp.sqlite"
        temp_db.write_bytes(zip_file.read(collection_name))

    connection = sqlite3.connect(temp_db)
    connection.row_factory = sqlite3.Row
    collection = connection.execute("SELECT decks, models FROM col LIMIT 1").fetchone()
    decks = json.loads(collection["decks"])
    models = json.loads(collection["models"])
    notes = {int(row["id"]): row for row in connection.execute("SELECT id, guid, mid, tags, flds, sfld FROM notes")}
    card_rows = list(connection.execute("SELECT id, nid, did, ord, reps, lapses, ivl, due FROM cards"))
    connection.close()
    temp_db.unlink(missing_ok=True)

    deck_targets = {}
    cards = []
    for row in card_rows:
        note = notes.get(int(row["nid"]))
        if not note:
            continue

        model = models.get(str(note["mid"])) or {}
        templates = model.get("tmpls") or []
        template = templates[int(row["ord"])] if int(row["ord"]) < len(templates) else (templates[0] if templates else {})
        deck = decks.get(str(row["did"])) or {}
        deck_name = deck.get("name") or "Anki 导入"
        deck_path = split_path(deck_name)
        model_name = model.get("name") or "Anki 模板"
        template_name = template.get("name") or f"模板 {int(row['ord']) + 1}"
        field_defs = model.get("flds") or []
        values = str(note["flds"] or "").split(FIELD_SEPARATOR)
        fields = {field.get("name"): values[index] if index < len(values) else "" for index, field in enumerate(field_defs)}
        tags = [tag for tag in str(note["tags"] or "").strip().split() if tag]
        rendered_fields = {
            name: remove_external_images(rewrite_media(value))
            for name, value in fields.items()
        }

        rendered_front = rewrite_media(render_template(
            template.get("qfmt") or "{{Front}}",
            fields,
            tags,
            deck_name,
            template_name,
            cloze_index=int(row["ord"]) + 1,
        ))
        rendered_front = remove_external_images(rendered_front)
        question_html = strip_answer_html(rendered_front)
        rendered_back = rewrite_media(render_template(
            template.get("afmt") or "{{Back}}",
            fields,
            tags,
            deck_name,
            template_name,
            front_side="",
            cloze_index=int(row["ord"]) + 1,
            revealed=True,
        ))
        rendered_back = remove_external_images(rendered_back)
        if not rendered_back.strip():
            rendered_back = rewrite_media(render_template(
                template.get("afmt") or "{{Back}}",
                fields,
                tags,
                deck_name,
                template_name,
                front_side=rendered_front,
                cloze_index=int(row["ord"]) + 1,
                revealed=True,
            ))
            rendered_back = remove_external_images(rendered_back)

        html_sections = extract_toggle_sections(rendered_back) or make_field_sections(rendered_fields)
        front_source = (
            get_field(rendered_fields, "题目", "Front", "章节")
            or question_html
            or note["sfld"]
        )
        front_text = strip_answer_text(strip_tags(front_source))
        if not front_text:
            front_text = strip_answer_text(strip_tags(note["sfld"]))

        section_texts = [
            remove_known_prefix_text(section["text"], front_text) or section["text"]
            for section in html_sections
        ]
        back_text = normalize_text(" ".join(section_texts))
        if not back_text:
            back_source = (
                get_field(rendered_fields, "Back", "答案与解析", "解析", "答案", "原文", "我的笔记")
                or rendered_back
            )
            back_text = remove_known_prefix_text(strip_tags(back_source), front_text)
        if not back_text or normalize_text(back_text) == normalize_text(front_text):
            for value in rendered_fields.values():
                candidate = remove_known_prefix_text(strip_tags(value), front_text)
                if candidate and normalize_text(candidate) != normalize_text(front_text):
                    back_text = candidate
                    break
        if not back_text:
            back_text = strip_tags(get_field(rendered_fields, "Back") or rendered_back or front_source)
        if not front_text or not back_text:
            continue

        section, name, chapter = target_for_path(deck_path)
        deck_id = "builtin-dyl-deck-" + stable_id(name)
        deck_targets[deck_id] = {
            "id": deck_id,
            "name": name,
            "description": f"内置资料包{PACK_TITLE} / {name}，登录后可见。",
            "section": section,
            "chapter": chapter,
            "color": "mint",
            "createdAt": 1760000000000 + len(deck_targets),
            "builtinPack": PACK_ID,
        }

        front_html = pick_front_html(question_html, front_source, front_text)
        if html_sections:
            back_html = make_html(render_sections_html(html_sections), back_text) or make_html(render_section_html(html_sections[0]), back_text)
        else:
            back_html = make_html(clean_html_fragment(rendered_back), back_text)
        card_css = make_css(model.get("css") or "") if (front_html or back_html) else ""
        source_key = f"apkg:{note['id']}:{row['id']}:{row['ord']}"
        cards.append({
            "id": "builtin-dyl-card-" + str(row["id"]),
            "deckId": deck_id,
            "front": front_text,
            "back": back_text,
            "frontHtml": front_html,
            "backHtml": back_html,
            "cardCss": card_css,
            **({"htmlSections": html_sections} if html_sections else {}),
            "template": "anki",
            "tags": tags,
            "favorite": False,
            "flagged": False,
            "comment": "",
            "createdAt": 1760000000000 + len(cards),
            "review": {"dueDate": "", "interval": 0, "ease": 2.5, "reps": 0, "lapses": 0, "lastGrade": None},
            "builtinPack": PACK_ID,
            "sourceKey": source_key,
            "source": {
                "type": "apkg",
                "builtinPack": PACK_ID,
                "fileName": "【DYL】考试分析重新排版311.apkg",
                "ankiNoteId": str(note["id"]),
                "ankiCardId": str(row["id"]),
                "ankiDeckId": str(row["did"]),
                "deckName": deck_name,
                "deckPath": deck_path,
                "modelName": model_name,
                "templateName": template_name,
            },
        })

    deck_list = sorted(deck_targets.values(), key=lambda deck: deck["createdAt"])
    cards = sorted(cards, key=lambda card: card["createdAt"])
    bundle_dir = ROOT / "public" / "bundles" / PACK_ID
    chunk_dir = bundle_dir / "cards"
    chunk_dir.mkdir(parents=True, exist_ok=True)
    for stale_chunk in chunk_dir.glob("*.json"):
        stale_chunk.unlink()

    card_chunks = []
    for index in range(0, len(cards), CARD_CHUNK_SIZE):
        chunk_cards = cards[index:index + CARD_CHUNK_SIZE]
        chunk_name = f"cards/chunk-{index // CARD_CHUNK_SIZE:03d}.json"
        chunk_path = bundle_dir / chunk_name
        chunk_path.write_text(json.dumps({
            "cards": chunk_cards,
        }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        card_chunks.append(chunk_name)

    output = bundle_dir / "data.json"
    output.write_text(json.dumps({
        "packId": PACK_ID,
        "title": PACK_TITLE,
        "decks": deck_list,
        "cardChunks": card_chunks,
        "cardCount": len(cards),
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "apkg": str(APKG),
        "decks": len(deck_list),
        "cards": len(cards),
        "chunks": len(card_chunks),
        "media": len(list(MEDIA_DIR.iterdir())),
        "dataBytes": output.stat().st_size,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
