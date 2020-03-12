---
title: Spring Boot - RestTemplate在URL中转义字符问题
date: 2020-03-11
tags: 
  - SpringBoot
categories: JAVA
---
### Spring Boot - RestTemplate在URL中转义字符转问题

> **相同代码在不同SpringBoot版本中使用RestTemplate请求时遇到的问题：**

```java
            Map<String, Object> param = new HashMap<String, Object>();
            StringBuilder paramStr = new StringBuilder();
            param.put("version","xxxxx");
            param.put("time","xxxxx");
            // 转化成md5生产密钥
            String userSign  = md5(param);
            // 将密钥加入
            param.put("user_sign", userSign);
            // 拼接url串
            for(Map.Entry<String, Object> entry : param.entrySet()){
                paramStr.append(entry.getKey()).append("=")
                        .append(entry.getValue() == null ? "" : String.valueOf(entry.getValue()))
                        .append("&");
            }
            paramStr.deleteCharAt(paramStr.length() - 1);
            // 发送请求
            String smsJsonStr = restTemplate.getForObject(SMSURL + paramStr.toString(), String.class);
```

> 下面截图为**springboot1.5.3 RestTemplate request log**
![springboot1.5.3 RestTemplate request log](https://img-blog.csdnimg.cn/20200311113022113.png)

> 下面截图为**springboot2.1.7 RestTemplate request log**
![springboot2.1.7 RestTemplate request log](https://img-blog.csdnimg.cn/2020031113432237.png)


在这两份log中可以看到user_sign对应的value值中的 **+** 是特殊的字符，**1.0版本**的被转义为: **%2B**，**2.0版本**没有被转义，最终**2.0版本**程序的RestTemplate请求第三方在签名解码时校验不通过。
#### 1.尝试与分析
 根据上述信息我们可以圈定问题的范围，**=** 有被转码，说明可能是在RestTemplate中url参数的构建转码的方式上与httpClient有什么不通，尝试进行各类处理方法。
主要使用的方式有：

 - UriComponent构建uri（未解决）
 - 构建如下RestTemplateConfig（未解决）
```java
public class RestTemplateConfig {
    @Bean
    RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setReadTimeout(40000);
        requestFactory.setConnectTimeout(40000);

        // 添加转换器
        List<HttpMessageConverter<?>> messageConverters = new ArrayList<>();
        messageConverters.add(new StringHttpMessageConverter(Charset.forName("UTF-8")));
        messageConverters.add(new FormHttpMessageConverter());
        messageConverters.add(new MappingJackson2HttpMessageConverter());

        RestTemplate restTemplate = new RestTemplate(messageConverters);
        restTemplate.setRequestFactory(requestFactory);
        restTemplate.setErrorHandler(new DefaultResponseErrorHandler());
        return restTemplate;
    }

}
```

#### 2.跟踪RestTemplate源码
![RestTemplate源码](https://img-blog.csdnimg.cn/20200311161256330.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3dlaXhpbl80NDczOTM0OQ==,size_16,color_FFFFFF,t_70)debug到这里时发现user_sign被转义了但 **+** 没有变。
![URLDecode](https://img-blog.csdnimg.cn/2020031116233315.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3dlaXhpbl80NDczOTM0OQ==,size_16,color_FFFFFF,t_70)这时URLDecoder.decode("/QaNSBls/U8ciXEWaCWtmeMK6+w%3D")会发现 **+** 变成了 **空格**，导致第三方在签名解码时校验不通过。

![在这里插入图片描述](https://img-blog.csdnimg.cn/20200311163956979.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3dlaXhpbl80NDczOTM0OQ==,size_16,color_FFFFFF,t_70)
![isAllowed](https://img-blog.csdnimg.cn/20200311163726761.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3dlaXhpbl80NDczOTM0OQ==,size_16,color_FFFFFF,t_70)再次通过比较会发现**StringBoot2.0版本**对应的URL转码 **+** 不会被解析。

 **经过多次百度有看到如下：**
 

> 根据 RFC 3986 加号等符号的确实可以出现在参数中的，而且不需要编码，有问题的在于服务端的解析没有与时俱进

#### 3.解决问题
最后解决一些这个问题，当使用RestTemplate发起请求，如果请求参数中有需要url编码时，通过如下两种方式解决：

 1. 不希望出现问题的使用姿势应传入URI对象而不是字符串，修改RestTemplate请求方法入参的`String url` 修改为 `URI url`。
 2. 修改入参编码格式` URLEncoder.encode(user_sign, "UTF-8")`，然后在构建RestTemplate时，

```java
            Map<String, Object> param = new HashMap<String, Object>();
            StringBuilder paramStr = new StringBuilder();
            param.put("version","xxxxx");
            param.put("time","xxxxx");
            // 转化成md5生产密钥
            String userSing  = md5(param);
            // 将字符串转成UTF-8
            String userSign = URLEncoder.encode(userSing, "UTF-8");
            // 将密钥加入
            param.put("user_sign", userSign);
            // 拼接url串
            for(Map.Entry<String, Object> entry : param.entrySet()){
                paramStr.append(entry.getKey()).append("=")
                        .append(entry.getValue() == null ? "" : String.valueOf(entry.getValue()))
                        .append("&");
            }
            paramStr.deleteCharAt(paramStr.length() - 1);
            // 发送请求
            String smsJsonStr = restTemplate.getForObject(SMSURL + paramStr.toString(), String.class);
            
```
#### 小结
注意**SpringBoot2.0版本**的url参数编码，默认只会针对 **= 和 &** 进行处理；为了兼容我们一般的后端的url编解码处理在需要编码参数时，个人建议尽量不要使用Spring默认的方式，不然接收到数据会和预期的不一致。