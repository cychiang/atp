FROM node:latest
MAINTAINER Casper CY Chiang <cychiang0823@gmail.com>

# create project folder
RUN ["mkdir", "-p", "/nctu-projects/atp"]
COPY package.json /nctu-projects/atp
COPY site /nctu-projects/atp/site
# 
WORKDIR /nctu-projects/atp
RUN ["npm", "install"]
EXPOSE 8080
ENTRYPOINT ["node", "site/server.js"]
