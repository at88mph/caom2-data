FROM node:alpine

ADD ./ /home/node/app/

WORKDIR /home/node/app/

EXPOSE 3000

CMD ["npm", "run", "start"]