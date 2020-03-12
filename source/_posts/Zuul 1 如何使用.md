---
title: Zuul1 如何使用
date: 2019-10-19
tags: 
  - Zuul 
categories: 微服务
author: YaNll
---
1\. 介绍
------

目前使用最多的是Spring Cloud Zuul, 所以本文也针对Spring讲解。

2\. 使用
------

共3步

### 1.创建一个spring boot工程

如何创建本文不做讲解

### 2\. 修改pom引入zuul和eureka

本文服务治理使用Eureka也可以使用其他组件，例如： Consul。

```sh
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-server</artifactId>
</dependency>
		
<dependency>
	<groupId>org.springframework.cloud</groupId>
	<artifactId>spring-cloud-starter-netflix-zuul</artifactId>
</dependency>
```

### 3.添加注释

在启动类上加上注释＠EnableZuulProxy，@EnableEurekaClient

### 4.添加配置

```sh
#eureka配置
eureka:
  client:
    serviceUrl:
      defaultZone: http://xxxxx/eureka/

server:
  #服务端口
  port: 9091
  #内核设置 tomcat or undertow
  #undertow是一个轻量级、高性能容器。
  #undertow 提供阻塞或基于 XNIO 的非阻塞机制，包大小不足 1M，内嵌模式运行时的堆内存占用只有 4M。
  undertow:
    #CPU核数(物理)
    io-threads: 1
    # io-threads * 8
    worker-threads: 8
    direct-buffers: true
    buffer-size: 1024 # 字节数
#  tomcat:
#    #等待队列长度
#    accept-count: 1000
#    #最大线程数
#    max-threads: 1000
#    #最大连接数
#    max-connections: 2000

#服务名称
spring:
  application:
    name: zuul-service

#路由配置
zuul:
  prefix: /zuul
  host:
    #使用 HttpClient 时有效，使用 OkHttp 无效
    #默认20
    max-per-route-connections: 1000
    #默认200
    max-total-connections: 1000
  #默认是使用信号量隔离
  semaphore:
    max-semaphores: 5000
    
#默认是根据服务注册的服务名称进行转发，同时也可以单独指定
#  routes:
#    api-a:
#      path: /api-a/**
#      serviceId: service-ribbon
#    api-b:
#      path: /api-b/**
#      serviceId: service-feign

#hystrix配置
hystrix:
  command:
    default:
      execution:
        isolation:
          thread:
            #超时熔断60s
            timeoutInMilliseconds: 60000

#ribbon配置
ribbon:
  ConnectTimeout: 5000
  ReadTimeout: 5000
  MaxAutoRetries: 1 # 对第一次请求的发我的重试次数
  MaxAutoRetriesNextServer: 1 #要重试的下一个服务的最大数量（不包括第一个服务）
  OkToRetryOnAllOperations: true
```

3\. 配置详解
--------

### 1\. 关于超时设置

zuul的超时配置有两种方式：

* 直接使用url配置的路由，是基于httpclient来发送请求，可以直接设置socket的连接时间

```sh
  zuul:
    host:
      socket-timeout-millis: 1000
      connect-timeout-millis : 2000
```

* 使用ribbon的轮训机制，可以配置ribbon超时时间，也可以配置hystrix超时时间，两者取配置最小者

```sh
ribbon:
  ConnectTimeout: 1000
  ReadTimeout: 1000
hystrix:
  command:
    default:
      execution:
        isolation:
          thread:
            timeoutInMillisecond: 1000
```

### 2\. 路由相关配置

### 模式

* serviceId模式

```sh
zuul:
  routes:
    api-a:
      path: /api-a/**
      serviceId: service-one
```

* url模式

不能使用Hystrix和Ribbon

```sh
zuul:
  routes:
    api-b:
      path: /api-b/**
      url: http://localhost:8081/
```



### 路由配置

一般是写成如下格式：

```sh
#路由名称 api-a 
#路由地址为 /api-a/**
#路由服务为service-one
zuul:
  routes:
    api-a:
      path: /api-a/**
      serviceId: service-one
```

还可以更简单一点如下：

```sh
zuul:
  routes:
    service-one: /api-a/**
```

如果路由映射规则不写也可以，系统会默认生成，比如service-one,service-two 不自动生成如下格式：

```sh
zuul:
  routes:
    service-one:
      path: /service-one/**
      serviceId: service-one
    service-two:
      path: /service-two/**
      serviceId: service-two
```

如果像排除某个服务路由映射 可以使用如下配置：

```sh
zuul:
  ignored-services: service-two
```

如果只是不想给默写几个做映射，可以使用如下配置：

```sh
zuul:
  ignored-patterns: /**/hello/**
```

如果希望在访问的url上加前缀路径：

```sh
zuul:
  prefix: /api
```

如果希望某个接口访问zuul本地的接口,而不是路由到服务：

```sh
zuul:
  routes:
    local:
      path: /local/**
      url: forward:/local
```

url通配符规则如下：

通配符 含义 举例 解释   ? 匹配任意单个字符 /service-one/? 匹配/service-one/a,/service-one/b,/service-one/c等   \* 匹配任意数量的字符 /service-one/\* 匹配/service-one/aaa,service-one/bbb,/service-one/ccc等
 ，无法匹配/service-one/a/b/c   \*\* 匹配任意数量的字符 /service-one/\*\* 匹配/service-one/aaa,service-one/bbb,/service-one/ccc等
 ，也可以匹配/service-one/a/b/c

### 3\. 连接数配置

zuul的连接数配置有两种方式：

* 直接使用url配置的路由，适用于ApacheHttpClient，如果是okhttp无效。每个服务的http客户端连接池最大连接和每个route可用的最大连接数

```sh
  zuul:
    host:
      max-total-connections: 200
      max-per-route-connections: 20
```

* 使用ribbon的超时

```sh
  ribbon:
    MaxTotalConnections: 200   # 默认值
    MaxConnectionsPerHost: 20 # 默认值
```

###  4\. 隔离策略

默认情况下，Zuul的隔离策略是SEMAPHORE（也是目前比较推荐的）。

可设置将隔离策略改为THREAD。

```sh
zuul.ribbonIsolationStrategy=THREAD
```

* 线程隔离 - THREAD

当设置隔离策略为THREAD时，Hystrix的线程隔离策略将作用所有路由，HystrixThreadPoolKey 默认为RibbonCommand，这意味着，所有路由的HystrixCommand都会在相同的Hystrix线程池中执行。可使用以下配置，让每个路由使用独立的线程池:

```sh
zuul:
  ribbonIsolationStrategy: THREAD
  threadPool:
    useSeparateThreadPools: true
    threadPoolKeyPrefix: zuulgw
```

* 信号量隔离 - SEMAPHORE

```sh
zuul:
  semaphore:
    max-semaphores: 100 # 默认值
```

为指定服务配置信号量(推荐用法)

```sh
zuul:
  eureka:
    <serviceId>:
      semaphore:
        max-semaphores: 100 # 默认值
```

配置生效优先级如下(优先级依次降低)：

```sh
[优先级1] zuul.eureka.api.semaphore.maxSemaphores
[优先级2] zuul.semaphore.max-semaphores
[优先级3] hystrix.command.api.execution.isolation.semaphore.maxConcurrentRequests
[优先级4] hystrix.command.default.execution.isolation.semaphore.maxConcurrentRequests
```

### 5\. 与Hystrix

默认是开启，只需配置timeout即可

```sh
hystrix:
  command:
    default:
      execution:
        isolation:
          thread:
            timeoutInMillisecond: 1000
```

设置超时也可以针对某些服务

```sh
[优先级1] hystrix.command.default.XXX
[优先级2] hystrix.command.[HystrixCommandKey].XXX
```

其他配置

```sh
hystrix:
  command:
    #指任意时间点允许的并发数。当请求达到或超过该设置值后，其其余就会被拒绝。默认值是100。
    default:execution.isolation.semaphore.maxConcurrentRequests
    #要使用hystrix的超时fallback，必须设置，默认开启
    execution.timeout.enabled
    #发生超时是是否中断线程，默认是true。
    execution.isolation.thread.interruptOnTimeout
    #取消时是否中断线程，默认是false。
    execution.isolation.thread.interruptOnCancel
    #*hystrix.command.default.fallback.isolation.semaphore.maxConcurrentRequests
    #设置fallback的线程数，默认是10，这个值在大量触发fallback逻辑时要注意调整。

```

### 6\. 与Ribbon

```sh
ribbon:
  #ribbon重试超时时间
  ConnectTimeout: 250
  #建立连接后的超时时间
  ReadTimeout: 1000
  #对所有操作请求都进行重试
  OkToRetryOnAllOperations: true
  #切换实例的重试次数
  MaxAutoRetriesNextServer: 2
  #对当前实例的重试次数
  MaxAutoRetries: 1
  eureka:
      enable: true
```

```sh
zuul:
  #默认为true
  retryable: true
```

如果使用重试配置需要 pom 需引入jar包

```sh
<dependency>
    <groupId>org.springframework.retry</groupId>
    <artifactId>spring-retry</artifactId>
</dependency>
```

### 7\. 其他

禁用Filter

```sh
zuul.FormBodyWrapperFilter.pre.disable= true
```

### 8\. 说明

以上配置主要是针对Dalston版本

