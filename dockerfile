FROM ubuntu:20.04 as builder

RUN mkdir /data
        
WORKDIR /data

RUN git clone https://github.com/yeastgenome/SGDFrontend_docker.git

FROM ubuntu:20.04

RUN DEBIAN_FRONTEND=noninteractive apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y \
        apache2 \
        make \
	emboss \
        python3-pip \
	ruby-dev \
	bundler \
	npm
    && pip3 install virtualenv 

WORKDIR /data
RUN mkdir www \
    && cd /www \
    && mkdir logs
    
WORKDIR /data/www
COPY --from=builder /data/SGDFrontend_docker/www .
WORKDIR /data/www/SGDFrontend/src/sgd/frontend
COPY config.py .

WORKDIR /data/www/SGDFrontend/src/sgd/tools/seqtools/emboss
RUN /usr/bin/rebaseextract -infile withrefm.809 -protofile proto.809

WORKDIR /data/www
RUN virtualenv venv && . venv/bin/activate

RUN cd SGDFrontend \
    make build \ 
    && pserve sgdfrontend_development.ini --reload > /data/www/logs/error.log 2>&1 &

WORKDIR /

CMD ["apachectl", "-D", "FOREGROUND"]