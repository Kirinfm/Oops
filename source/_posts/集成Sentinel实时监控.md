---
title: 集成Sentinel实时监控
date: 2022-06-02
author: FM
tags: 
  - Alibaba Sentinel 
categories: JAVA
---
本文仅针对于 sentinel 的监控功能进行分析说明

## Sentinel 基本功能
Sentinel 是面向分布式服务架构的高可用流量防护组件，主要以流量为切入点，从限流、流量整形、熔断降级、系统负载保护、热点防护等多个维度来帮助开发者保障微服务的稳定性。

## 监控
Sentinel通过定时拉取并且聚合应用监控信息，最终实现秒级的实时监控。
[sentinel监控API](https://sentinelguard.io/zh-cn/docs/metrics.html)

![](resources/50678855-aa6e9700-103b-11e9-83de-2a33e580325f.png)

### 资源数据
#### 秒级日志
所有资源的秒级日志在 `${home}/logs/csp/${appName}-${pid}-metrics.log.${date}.xx`。例如，该日志的名字可能为 `app-3518-metrics.log.2018-06-22.1`
```text
1529573107000|2018-06-21 17:25:07|sayHello(java.lang.String,long)|10|3601|10|0|2
```

| index | 字段 | 例子 | 说明 |
| ---- | ---- | ---- | ---- |
|1|timestamp|1529573107000|时间戳|
|2|-|2018-06-21 17:25:07|日期|
|3|resource|sayHello(java.lang.String,long)|资源名称|
|4|passQps|10|每秒通过的资源请求个数|
|5|blockQps|3601|每秒资源被拦截的个数|
|6|successQps|10|每秒结束的资源个数，包括正常结束和异常结束的情况|
|7|exceptionQps|0|每秒资源的异常个数|
|8|rt|2|资源平均响应时间|
|9|occupiedPassQps|2|占用等待放行QPS (1.5.0 加入)|
|10|concurrency|2|并发, (1.7.0 加入)|
|11|classification|2|分类, (1.7.0 加入 SQL/RPC)|

#### 拦截日志
每秒的拦截日志则会记录在 `sentinel-block.log` 文件下。如果没有发生拦截，则该日志不会出现。
```text
2014-06-20 16:35:10|1|sayHello(java.lang.String,long),FlowException,default,origin|61,0
2014-06-20 16:35:11|1|sayHello(java.lang.String,long),FlowException,default,origin|1,0
```
| index | 例子 | 说明 |
| ---- | ---- | ---- |
|1|1529573107000|时间戳|
|2|2018-06-21 17:25:07|日期|
|3|sayHello(java.lang.String,long)|资源名称|
|4|10|每秒通过的资源请求个数|
|5|3601|每秒资源被拦截的个数|
|6|10|每秒结束的资源个数，包括正常结束和异常结束的情况|
|7|0|每秒资源的异常个数|

### 集成方案
#### 接入
maven依赖
```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
</dependency>
```
核心实现 `MetricTimerListener`
sentinel 每1秒聚合当前线程中的数据, 并写入秒级日志中。

日志写入参考 `MetricWriter`

#### 交互
Dashboard和微服务之间sentinel提供了http的方式进行交互, 有三种服务集成方式
```xml
<!-- netty -->
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-transport-simple-http</artifactId>
</dependency>
<!-- net socket -->
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-transport-simple-http</artifactId>
</dependency>
<!-- spring mvc -->
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-transport-spring-mvc</artifactId>
</dependency>
```
微服务通过发送心跳到Dashboard, 参考 `SimpleHttpHeartbeatSender`, 其中心跳仅支持单点, 若部署的 dashboard 是集群则需要自行实现 `HeartbeatSender` 类。
```java
package com.alibaba.csp.sentinel.transport;

public interface HeartbeatSender {
    // 发送心跳
    boolean sendHeartbeat() throws Exception;
    // 心跳间隔时长
    long intervalMs();
}
```
#### 聚合监控
Dashboard 主要调用了 [sentinel监控API](https://sentinelguard.io/zh-cn/docs/metrics.html) 中的接口进行聚合操作。
* 心跳记录
Dashboard 提供 `/registry/machine` 接口用于接收心跳
```java
    @RequestMapping("/registry/machine")
    public Boolean receiveHeartBeat(String app,
        @RequestParam(value = "app_type", required = false, defaultValue = "0")
            Integer appType, Long version, String v, String hostname, String ip,
        Integer port) {
    }
```
* 拉取日志
启动定时任务，通过心跳记录的机器地址进行拼接拉取每秒的调用记录
`GET http://machineIp:machinePort/metric?startTime=&endTime=`

    可使用以下 URL 参数：
    * identity：资源名称
    * startTime：开始时间（时间戳）
    * endTime：结束时间
    * maxLines：监控数据最大行数
    
    响应
    ```text
    1529998904000|2018-06-26 15:41:44|abc|100|0|0|0|0
    1529998905000|2018-06-26 15:41:45|abc|4|5579|104|0|728
    1529998906000|2018-06-26 15:41:46|abc|0|15698|0|0|0
    1529998907000|2018-06-26 15:41:47|abc|0|19262|0|0|0
    1529998908000|2018-06-26 15:41:48|abc|0|19502|0|0|0
    1529998909000|2018-06-26 15:41:49|abc|0|18386|0|0|0
    1529998910000|2018-06-26 15:41:50|abc|0|19189|0|0|0
    1529998911000|2018-06-26 15:41:51|abc|0|16543|0|0|0
    1529998912000|2018-06-26 15:41:52|abc|0|18471|0|0|0
    1529998913000|2018-06-26 15:41:53|abc|0|19405|0|0|0
    ```
