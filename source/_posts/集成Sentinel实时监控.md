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
所有资源的秒级日志在 ${home}/logs/csp/${appName}-${pid}-metrics.log.${date}.xx。例如，该日志的名字可能为 app-3518-metrics.log.2018-06-22.1
```text
1529573107000|2018-06-21 17:25:07|sayHello(java.lang.String,long)|10|3601|10|0|2
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
|8|2|占用等待放行QPS|
|9|2|并发|
|10|2|分类|

