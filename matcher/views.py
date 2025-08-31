from django.http import HttpResponse
from django.shortcuts import render

def health(request):
    return HttpResponse("OK from Django")

def home(request):
    return render(request, "home.html")  # your template at matcher/templates/home.html
