from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("", include("matcher.urls")),           # landing page/form
    path("ik-admin-7c5b6167/", admin.site.urls) # optional hardened admin path
]
