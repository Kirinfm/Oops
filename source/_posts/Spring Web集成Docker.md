---
title: Spring Web集成Docker
date: 2019-12-19
tags: 
  - Docker 
  - SpringBoot
categories: JAVA
---
* 根目录创建docker 文件夹

  docker

   |-- webapps（web目录）

   |-- Dockerfile
* dockerfile

      FROM tomcat:8.0

    ENV CATALINA\_HOME /usr/local/tomcat

    WORKDIR $CATALINA\_HOME

    \# start modify
    RUN cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
    RUN echo "Asia/Shanghai" \> /etc/timezone

    \# copy war
    COPY webapps/\*.war /usr/local/tomcat/webapps/

    EXPOSE 8080
    CMD ["catalina.sh", "run"]
* pom.xml 增加插件

      \<plugins\>
     \<plugin\>
     \<artifactId\>maven-war-plugin\</artifactId\>
     \<configuration\>
     \<!--设置将war包打包至webapps下--\>
     \<outputDirectory\>${basedir}/docker/webapps\</outputDirectory\>
     \</configuration\>
     \</plugin\>
     \<plugin\>
     \<groupId\>com.spotify\</groupId\>
     \<artifactId\>docker-maven-plugin\</artifactId\>
     \<version\>0.4.13\</version\>
     \<configuration\>
     \<imageName\>${project.name}:${project.version}\</imageName\>
     \<!--Dockerfile文件位置--\>
     \<dockerDirectory\>${basedir}/docker\</dockerDirectory\>
     \</configuration\>
     \</plugin\>
    \</plugins\>
* 执行 `mvn clean package docker:build`

  若镜像需要发布则执行 `mvn clean package docker:build -DpushImage`
* 执行 `docker run -p 8080:8080 -it ${project.name}:${project.version}`

附无需maven打包docker方法
==================

* 启动docker 并将webapps挂载出来
`docker run -p 8080:8080 -v /usr/local/tomcat/webapps/:/usr/local/tomcat/webapps/ -it tomcat:8.0`
* 将war包复制到挂载目录
`cp webapps/*.war /usr/local/tomcat/webapps/`
* 重启docker
`docker restart ${container}`

 源码地址：https://github.com/Kirinfm/spring-web-docker
