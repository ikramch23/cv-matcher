from django.shortcuts import render
from rapidfuzz import fuzz
from pypdf import PdfReader
from docx import Document


def _extract_text(uploaded_file) -> str:
    """
    Read text from an uploaded .pdf / .docx / .txt file without saving to disk.
    Returns empty string on failure.
    """
    if not uploaded_file:
        return ""

    name = (uploaded_file.name or "").lower()
    try:
        if name.endswith(".pdf"):
            reader = PdfReader(uploaded_file)
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
            uploaded_file.seek(0)
            return text
        elif name.endswith(".docx"):
            doc = Document(uploaded_file)
            text = "\n".join(p.text for p in doc.paragraphs)
            uploaded_file.seek(0)
            return text
        else:
            # treat as plain text
            data = uploaded_file.read()
            uploaded_file.seek(0)
            try:
                return data.decode("utf-8", errors="ignore")
            except Exception:
                return ""
    except Exception:
        return ""


def home(request):
    """
    Show a form; on POST, compute a quick similarity score between the CV text and the job description.
    Uses RapidFuzz token_set_ratio (fast & lightweight).
    """
    context = {}
    if request.method == "POST":
        cv_file = request.FILES.get("cv")
        jd_text = request.POST.get("jd", "")

        cv_text = _extract_text(cv_file)
        score = fuzz.token_set_ratio(cv_text, jd_text) if (cv_text and jd_text) else 0

        context.update(
            {
                "score": int(score),
                "cv_name": cv_file.name if cv_file else "",
                "jd_text": jd_text,
                "had_input": True,
            }
        )

    return render(request, "matcher/home.html", context)
