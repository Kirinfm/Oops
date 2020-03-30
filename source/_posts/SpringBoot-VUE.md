---
title: 如何集成SpringBoot项目和VUE项目
date: 2020-03-30
author: FM
tags: 
  - WEB 
  - VUE 
  - SpringBoot
categories: 
  - JAVA
  - VUE
---

* 前言

  众所周知, SpringBoot内置了tomcat, 可以直接执行jar包启动一个SpringBoot服务。因此VUE编译后的文件也可以部署再tomcat中提供访问, 这样对于轻量的应用无需再部署一个nginx。
  
* SpringBoot 的静态内容
  
  参考 [static content](https://docs.spring.io/spring-boot/docs/2.2.6.RELEASE/reference/htmlsingle/#boot-features-spring-mvc-static-content)
  
  SpringBoot默认将 `/static` (或者 `/public` 或者 `/resources` 或者 `/META-INF/resources`) 读取为静态内容。
  其中 `static` 或者 `/template` 可以被用为欢迎页, 所以VUE编译后的静态文件可以放在 `static`下提供访问。
  
* 部署

  > 为了避免静态路由与Rest Api冲突, 需再VUE中设置 `publicPath: '/web'`
  * 在`static`文件夹中创建目录 `web`, 将VUE编译后的 `dist` 中的内容复制至 `web`目录下
  * 将 `/web` 增加在 token 校验忽略路径中
  * 若VUE采用的是 history 模式, 需要增加未找到页面跳转配置。
  ```
  @Component
  public class NotFoundPageConfig implements ErrorPageRegistrar {
      @Override
      public void registerErrorPages(ErrorPageRegistry registry) {
          ErrorPage error404Page = new ErrorPage(HttpStatus.NOT_FOUND, "/web/index.html");
          registry.addErrorPages(error404Page);
      }
  }
  ``` 
  * 启动SpringBoot, 访问 `http://localhost:[端口]/web` 即可
  
