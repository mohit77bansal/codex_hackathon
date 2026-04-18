import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "swarm_os.settings")

app = Celery("swarm_os")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
