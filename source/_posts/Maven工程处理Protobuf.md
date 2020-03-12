---
title: Maven工程处理Protobuf
date: 2019-09-15
tags: 
  - Maven 
  - Protobuf
categories: JAVA
author: ,YaNll
---
一、引言
----

Java 开发中特别是进程间通讯，往往会用到google的protobuf作为数据格式，但是处理protobuf的时候需要编解码，这里在maven工程集成了protobuf插件方便开发使用。

二、方法
----

### 1\. 在pom文件中配置相应的jar包

```sh
<dependency>
    <groupId>com.google.protobuf</groupId>
    <artifactId>protobuf-java</artifactId>
    <version>3.2.0</version>
</dependency>
```

### 2\. 在build中添加配置

```sh
<build>
    <defaultGoal>package</defaultGoal>
    <extensions>
        <extension>
            <groupId>kr.motd.maven</groupId>
            <artifactId>os-maven-plugin</artifactId>
            <version>1.5.0.Final</version>
        </extension>
    </extensions>

    <plugins>
        <!-- protobuf 编译组件 -->
        <plugin>
            <groupId>org.xolstice.maven.plugins</groupId>
            <artifactId>protobuf-maven-plugin</artifactId>
            <version>0.5.1</version>
            <extensions>true</extensions>
            <configuration>
                <protoSourceRoot>${project.basedir}/src/main/proto</protoSourceRoot>
                <protocArtifact>com.google.protobuf:protoc:3.2.0:exe:${os.detected.classifier}</protocArtifact>
            </configuration>
            <executions>
                <execution>
                    <goals>
                        <goal>compile</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>

        <!-- 编译jar包的jdk版本 -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <version>3.1</version>
            <configuration>
                <source>${java.version}</source>
                <target>${java.version}</target>
            </configuration>
        </plugin>
 </plugins>
</build>
```

1\. 注意proto的版本

2\. 需要将需要编译的proto文件放入/src/main/proto目录下。如果没有则自行创建

三、编译
----

### 1\. 命令： mvn protobuf:compile

![](resources/9C3D86062D66843AC8E855BA82BBFA0F.jpg)

### 2\. IDEA开发工具

![](resources/1892D16BB70CD80025A457511C0457A1.jpg)

四、编译完成java文件位置
--------------

如下图

![](resources/77B9EE5AAE5928EFA66C341712F0B009.jpg)

五、总结
----

通过此方式，可以通过maven编译不同版本的proto，不需要开发机器安装proto也不需要，编译好java文件放到工程中。到此为止就可以在工程中自由引用编译protobuf了。

