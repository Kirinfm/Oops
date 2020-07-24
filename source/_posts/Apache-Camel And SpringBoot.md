---
title: Apache Camel And SpringBoot
date: 2020-07-23
author: FM
tags: 
  - Apache Camel 
  - Gradle 
  - SpringBoot
categories: 
  - JAVA
---

### Apache Camel
* ENDPOINT
    
    camel 提供了以下 endpoint 技术：
    * JMS queue
    * web service
    * file. 在某些场景中会有一个应用写文件, 另一个应用读文件
    * FTP server
    * email address. 客户端可以发送信息给一个邮件地址, 服务端可以从邮件服务器读取收到的信息
    * POJO(plain old java object)
    
    camel 通过 *routes* 将endpoints进行连接。
    
    Camel 提供了 java 接口 Endpoint. 每个Camel支持的endpoint 需要实现 Endpoint
    
* Components

    实际上就是 endpoint 工厂(EndpointFactory), 如果一个基于Camel的应用想要使用一些 JMS queue, 那么应用就要创建 JmsComponent (Component 的实现), 然后调用 createEndpoint(). 
    
* CamelContext
    
    CamelContext 代表 Camel 运行系统, 通常一个应用只有一个 CamelContext 对象, 通常应用的执行步骤如下: 
    1. 创建一个 CamelContext 对象
    2. 添加 endpoints (components) 到 CamelContext 对象
    3. 增加 routes 用来连接 endpoints 到 CamelContext 对象
    4. 调用 CamelContext 中的 start() 方法, 开始启动 Camel 内部的线程来处理 endpoints 的消息发送、接收和处理
    5. 最后调用 CamelContext 中的 end() 方法, 用于停止 Camel 启动的线程.
    
    > CamelContext.start() 不会一直阻塞, 相反, 它在每个组件和 endpoints 内部启动线程, 然后返回 start(). 而 CamelContext.stop() 会等待所有线程结束再返回stop()
    
* CamelTemplate

    CamelTemplate 和其他开源项目的命名方式一样, 比如 Spring 的 TransactionTemplate 和 JmsTemplate.
    
    CamelTemplate 是对 CamelContext 的轻量包装. 提供了向endpoint发送消息(Message)和exchange方法, 用于提供源endpoints输入消息, 然后通过 routes 发送至目标 endpoints.
    
* Message and Exchange

    Message接口为单个消息(如请求、应答或异常消息)提供了抽象.
    
    Exchange接口为消息交换提供了一个抽象，即请求消息及其相应的应答或异常消息。在Camel中，请求、应答和异常消息就是进、出和故障消息。
    
* Processor

    Processor是用于处理消息的接口.
    
    ```
    package org.apache.camel;
    public interface Processor {
        void process(Exchange exchange) throws Exception;
    }
    ```
  
* Routes, RouteBuilders And Java DSL

    route 是通过设置的决策(如过滤和路由)将输入队列的消息逐步发送至目标队列. Camel提供两种方式: 1. xml 2. java DSL
    
    java dsl 是 java domain-specific language.
    
    Example:
    ```
    RouteBuilder builder = new RouteBuilder() {
        public void configure() {
            from("queue:a").filter(header("foo").isEqualTo("bar")).to("queue:b");
            from("queue:c").choice()
                    .when(header("foo").isEqualTo("bar")).to("queue:d")
                    .when(header("foo").isEqualTo("cheese")).to("queue:e")
                    .otherwise().to("queue:f");
        }
    };
    CamelContext myCamelContext = new DefaultCamelContext();
    myCamelContext.addRoutes(builder);
    ```

* The Meaning of URL, URI, URN and IRI

    URL: 资源地址, 如 http:// , ftp:// , \mailto
    
    URI: 统一资源标识符(uniform resource identifier)
    
    URN: 统一资源名称(uniform resource name)
    
    IRI: 国际化资源标识符(internationalized resource identifier)
