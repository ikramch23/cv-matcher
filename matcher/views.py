from django.http import HttpResponse

def home(request):
    return HttpResponse("""
    <html>
      <head><title>CV-Matcher</title></head>
      <body style="font-family: system-ui; padding:24px">
        <h1>✅ CV-Matcher is live</h1>
        <p>Your PythonAnywhere deployment is working.</p>
        <p><a href="/admin/">Go to Django admin</a></p>
      </body>
    </html>
    """)
