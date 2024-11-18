FROM python:3.9

RUN mkdir -p /usr/src
WORKDIR /usr/src

COPY templates.py /usr/src/
COPY sailsman /usr/src/sailsman

RUN pip install --no-cache-dir -r sailsman/requirements.txt

ENTRYPOINT ["python", "-m", "sailsman"]
