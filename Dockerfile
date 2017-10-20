FROM node:alpine

VOLUME /home/node/app

ADD ./ /home/node/app/
WORKDIR /home/node/app/

EXPOSE 3000

CMD ["npm", "run", "start"]
