from django.contrib import admin
from django.http import HttpResponse
from django.urls import path

def root(_request):
    return HttpResponse(
        "<h1>✅ Django is serving /</h1><p>If you see this, routing works.</p>"
        '<p><a href="/admin/">Admin</a></p>'
    )

urlpatterns = [
    path("", root, name="root"),       # <-- direct handler for "/"
    path("admin/", admin.site.urls),
]
