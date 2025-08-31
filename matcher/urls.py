# matcher/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("health/", views.health, name="health"),
    path("download_txt/", views.download_txt, name="download_txt"),
]
