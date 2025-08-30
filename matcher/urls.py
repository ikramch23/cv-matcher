from django.urls import path
from .views import home

app_name = "matcher"

urlpatterns = [
    path("", home, name="home"),
]
