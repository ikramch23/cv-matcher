# matcher/views.py
from __future__ import annotations

import io
import re
from typing import List, Set, Tuple

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render

# Optional parsers
try:
    from PyPDF2 import PdfReader  # pip install PyPDF2
except Exception:
    PdfReader = None  # type: ignore

try:
    import docx  # pip install python-docx
except Exception:
    docx = None  # type: ignore


# --------------------- Helpers ---------------------

ALLOWED_EXTS = {".txt", ".pdf", ".docx"}
WORD_RE = re.compile(r"[A-Za-z][A-Za-z+\-.#]*")  # allow C++, Node.js, C#, etc.

STOP = {
    "a","an","the","and","or","to","of","for","in","on","at","with","by","as","is","are","was","were",
    "be","been","being","this","that","these","those","it","its","from","your","you","we","our",
    "i","me","my","he","she","they","them","their","his","her","but","if","so","than","then",
}


def _ext(name: str) -> str:
    m = re.search(r"\.[A-Za-z0-9]+$", name or "")
    return (m.group(0).lower() if m else "")


def extract_text_from_upload(filename: str, file_bytes: bytes) -> str:
    """Extract text from .txt / .pdf / .docx uploads. Returns '' if not readable."""
    ext = _ext(filename)

    if ext == ".txt":
        try:
            return file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            return file_bytes.decode("latin-1", errors="ignore")

    if ext == ".pdf":
        if not PdfReader:
            return ""
        reader = PdfReader(io.BytesIO(file_bytes))
        out = []
        for p in reader.pages:
            try:
                out.append(p.extract_text() or "")
            except Exception:
                pass
        return "\n".join(out)

    if ext == ".docx":
        if not docx:
            return ""
        bio = io.BytesIO(file_bytes)
        document = docx.Document(bio)
        return "\n".join(par.text for par in document.paragraphs)

    return ""


def tokenize(text: str) -> List[str]:
    return [w.lower() for w in WORD_RE.findall(text)]


def keywords(text: str) -> Set[str]:
    return {w for w in tokenize(text) if w not in STOP and len(w) >= 2}


def score_and_missing(cv_text: str, jd_text: str) -> Tuple[int, Set[str], Set[str], Set[str]]:
    """
    Score = coverage of JD keywords by CV: 100 * |JD∩CV| / |JD|
    Returns (score, jd_kw, cv_kw, missing_kw).
    """
    cv_kw = keywords(cv_text)
    jd_kw = keywords(jd_text)
    if not jd_kw:
        return 0, jd_kw, cv_kw, set()
    overlap = cv_kw & jd_kw
    missing = jd_kw - cv_kw
    score = round(100 * len(overlap) / max(1, len(jd_kw)))
    return score, jd_kw, cv_kw, missing


def build_improved_cv(cv_text: str, missing_kw: Set[str]) -> str:
    """Simple private improvement: append a section with missing keywords (editable)."""
    if not missing_kw:
        return cv_text.strip()
    block = (
        "\n\n---\n"
        "TAILORED KEYWORDS FOR THIS ROLE\n"
        f"{', '.join(sorted(missing_kw))}\n"
        "(Review and integrate naturally into your experience / skills sections.)\n"
    )
    return (cv_text.strip() + block).strip()


# --------------------- Views ---------------------

def health(request: HttpRequest) -> HttpResponse:
    return HttpResponse("OK")


def home(request: HttpRequest) -> HttpResponse:
    context = {"had_input": False}

    if request.method == "POST":
        jd_text = (request.POST.get("jd") or "").strip()

        cv_name = None
        cv_text = ""
        f = request.FILES.get("cv")
        if f:
            cv_name = getattr(f, "name", "cv")
            cv_bytes = f.read()
            cv_text = extract_text_from_upload(cv_name, cv_bytes) or ""

        score, jd_kw, cv_kw, missing_kw = score_and_missing(cv_text, jd_text)

        improved = build_improved_cv(cv_text, missing_kw)

        # Save improved CV only in session (no DB, private)
        request.session["improved_cv_text"] = improved

        context.update(
            had_input=True,
            score=score,
            cv_name=cv_name,
            jd_text=jd_text,
            missing_keywords=sorted(missing_kw),
            improved_text=improved,
        )

    return render(request, "home.html", context)


def download_txt(request: HttpRequest) -> HttpResponse:
    """Download the improved CV as .txt from session (no database)."""
    content = request.session.get("improved_cv_text", "")
    if not content:
        return HttpResponse("No improved CV available. Submit the form first.", status=400)

    resp = HttpResponse(content, content_type="text/plain; charset=utf-8")
    resp["Content-Disposition"] = 'attachment; filename="improved_cv.txt"'
    return resp
