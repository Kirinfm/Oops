---
title: 趣头条基于 Flink+ClickHouse 构建实时数据分析平台
date: 2020-04-30 11:23:00
categories: 推荐阅读
---
内容分为以下四部分：

* 一、业务场景与现状分析
* 二、Flink-to-Hive 小时级场景
* 三、Flink-to-ClickHouse 秒级场景
* 四、未来发展与思考

一、业务场景与现状分析
-----------

趣头条查询的页面分为离线查询页面和实时查询页面。趣头条今年所实现的改造是在实时查询中接入了 ClickHouse 计算引擎。根据不同的业务场景，实时数据报表中会展现数据指标曲线图和详细的数据指标表。目前数据指标的采集和计算为每五分钟一个时间窗口，当然也存在三分钟或一分钟的特殊情况。数据指标数据全部从 Kafka 实时数据中导出，并导入 ClickHouse 进行计算。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/9F2D6E0B27DDCE4111CF7F3FE4287E3E.jpg)

二、Flink-to-Hive 小时级场景
---------------------

### 1.小时级实现架构图

如下图所示，Database 中的 Binlog 导出到 Kafka，同时 Log Server 数据也会上报到 Kafka。所有数据实时落地到 Kafka 之后，通过 Flink 抽取到 HDFS。下图中 HDFS 到 Hive 之间为虚线，即 Flink 并非直接落地到 Hive，Flink 落地到 HDFS 后，再落地到 Hive 的时间可能是小时级、半小时级甚至分钟级，需要知道数据的 Event time 已经到何时，再触发 alter table，add partition，add location 等，写入其分区。

这时需要有一个程序监控当前 Flink 任务的数据时间已经消费到什么时候，如9点的数据，落地时需要查看 Kafka 中消费的数据是否已经到达9点，然后在 Hive 中触发分区写入。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/7D832D7E312780238AA218C0A93C1E38.jpg)

### 2.实现原理

趣头条主要使用了 Flink 高阶版本的一个特性——StreamingFileSink。StreamingFileSink 主要有几点功能。

* 第一， forBulkFormat 支持 avro、parquet 格式，即列式存储格式。
* 第二， withBucketAssigner 自定义按数据时间分桶，此处会定义一个EventtimeBucket，既按数据时间进行数据落地到离线中。
* 第三， OnCheckPointRollingPolicy，根据 CheckPoint 时间进行数据落地，在一定的 CheckPoint 时间内数据落地并回稳。按照 CheckPoint 落地还有其它策略，如按照数据大小。
* 第四， StreamingFileSink 是 Exactly-Once 语义实现。

Flink 中有两个 Exactly-Once 语义实现，第一个是 Kafka，第二个是 StreamingFileSink。下图为 OnCheckPointRollingPolicy 设计的每10分钟落地一次到HDFS文件中的 demo。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/670E4B76E3DABEAC48B6FE2C44B88AA1.jpg)

■ 如何实现 Exactly-Once

下图左侧为一个简单的二 PC 模型。Coordinator 发送一个 prepare，执行者开始触发 ack 动作，Coordinator 收到 ack 所有消息后，所有 ack 开始触发 commit，所有执行者进行落地，将其转化到 Flink 的模型中，Source 收到 checkpoint barrier 流时，开始触发一个 snapshot。

每个算子的 CheckPoint、snapshot 都完成之后，CheckPoint 会给 Job Manager 发送 notifyCheckpointComplete。下图中二阶段模型和 Flink 模型左侧三条线部分是一致的。因此用 Flink 可以实现二阶段提交协议。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/60FA5A89A97FE1DAD8570F82C20AF0C8.jpg)

■ 如何使用 Flink 实现二阶段提交协议

首先，StreamingFileSink 实现两个接口，CheckpointedFunction 和CheckpointListener。CheckpointedFunction 实现 initializeState 和 snapshotState 函数。CheckpointListener 是 notifyCheckpointComplete 的方法实现，因此这两个接口可以实现二阶段提交语义。

* initializeState

initializeState 在任务启动时会触发三个动作。第一个是 commitPendingFile。实时数据落地到 Hdfs 上有三个状态。第一个状态是 in-progress ，正在进行状态。第二个状态是 pending 状态，第三个状态是 finished 状态。

initializeState 在任务启动时还会触发 restoreInProgressFile，算子实时写入。如果 CheckPoint 还未成功时程序出现问题，再次启动时 initializeState 会 commit PendingFile，然后采用 Hadoop 2.7+ 版本的 truncate 方式重置或截断 in-progress 文件。

* invoke

实时写入数据。

* snapshotState

触发 CheckPoint 时会将 in-progress 文件转化为 pending state，同时记录数据长度（truncate 方式需要截断长度）。snapshotState 并非真正将数据写入 HDFS，而是写入 ListState。Flink 在 Barrier 对齐状态时内部实现 Exactly-Once 语义，但是实现外部端到端的 Exactly-Once 语义比较困难。Flink 内部实现 Exactly-Once 通过 ListState，将数据全部存入 ListState，等待所有算子 CheckPoint 完成，再将 ListState 中的数据刷到 HDFS 中。

* notifyCheckpointComplete

notifyCheckpointComplete 会触发 pending 到 finished state 的数据写入。实现方法是 rename，Streaming 不断向 HDFS 写入临时文件，所有动作结束后通过 rename 动作写成正式文件。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/165FDCE3FCE66B2AA2D97F25EEBC81D1.jpg)

### 3.跨集群多 nameservices

趣头条的实时集群和离线集群是独立的，离线集群有多套，实时集群目前有一套。通过实时集群写入离线集群，会产生 HDFS nameservices 问题。在实时集群中将所有离线集群的 nameservices 用 namenode HA 的方式全部打入实时集群并不合适。那么如何在任务中通过实时集群提交到各个离线集群？

如下图所示，在 Flink 任务的 resource 下面，在 HDFS 的 xml 中间加入 。在 PropertyHong Kong 中添加 nameservices，如 stream 是实时集群的 namenode HA 配置，data 是即将写入的离线集群的 namenode HA 配置。那么两个集群中间的 HDFS set 不需要相互修改，直接可以在客户端实现。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/15D8AAF2BB81D3B64109CB6283E69E9E.jpg)

### 4.多用户写入权限

实时要写入离线 HDFS，可能会涉及用户权限问题。实时提交的用户已经定义好该用户在所有程序中都是同一个用户，但离线中是多用户的，因此会造成实时和离线用户不对等。趣头条在 API 中添加了 withBucketUser 写 HDFS。配置好 nameservices后，接下来只需要知道该 HDFS 路径通过哪个用户来写，比如配置一个 stream 用户写入。

API 层级的好处是一个 Flink 程序可以指定多个不同的 HDFS 和不同的用户。多用户写入的实现是在 Hadoop file system 中加一个 ugi.do as ，代理用户。以上为趣头条使用 Flink 方式进行实时数据同步到 Hive 的一些工作。其中可能会出现小文件问题，小文件是后台程序进行定期 merge，如果 CheckPoint 间隔时间较短，如3分钟一次，会出现大量小文件问题。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/0F5509FDFD067760D47E88577A6561D0.jpg)

三、Flink-to-ClickHouse 秒级场景
--------------------------

### 1.秒级实现架构图

趣头条目前有很多实时指标，平均每五分钟或三分钟计算一次，如果每一个实时指标用一个 Flink 任务，或者一个 Flink SQL 来写，比如消费一个 Kafka Topic，需要计算其日活、新增、流程等等当用户提出一个新需求时，需要改当前的 Flink 任务或者启动一个新的 Flink 任务消费 Topic。

因此会出现 Flink 任务不断修改或者不断起新的 Flink 任务的问题。趣头条尝试在 Flink 后接入 ClickHouse，实现整体的 OLAP。下图为秒级实现架构图。从 Kafka 到 Flink，到 Hive，到 ClickHouse 集群，对接外部 Horizon（实时报表），QE（实时 adhoc 查询），千寻（数据分析），用户画像（实时圈人）。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/56F0FC05C5F0F5DBAF80188B0E4218C6.jpg)

### 2.Why Flink+ClickHouse

* 指标实现 sql 化描述：分析师提出的指标基本都以 SQL 进行描述。
* 指标的上下线互不影响：一个 Flink 任务消费 Topic，如果还需要其它指标，可以保证指标的上下线互不影响。
* 数据可回溯，方便异常排查：当日活下降，需要回溯排查是哪些指标口径的逻辑问题，比如是报的数据差异或是数据流 Kafka 掉了，或者是因为用户没有上报某个指标导致日活下降，而 Flink 则无法进行回溯。
* 计算快，一个周期内完成所有指标计算：需要在五分钟内将成百上千的所有维度的指标全部计算完成。
* 支持实时流，分布式部署，运维简单：支持 Kafka 数据实时流。

目前趣头条 Flink 集群有 100+ 台 32 核 128 G 3.5T SSD，日数据量 2000+ 亿，日查询量 21w+ 次，80% 查询在 1s 内完成。下图为单表测试结果。ClickHouse 单表测试速度快。但受制于架构，ClickHouse 的 Join 较弱。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/930D59C5D706AB26B82AB9A1F569BDA4.jpg)

下图是处理相对较为复杂的 SQL，count+group by+order by，ClickHouse 在 3.6s内完成 26 亿数据计算。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/1041740E90B9F19F79ACD0BF862021B0.jpg)

### 3.Why ClickHouse so Fast

ClickHouse 采用列式存储 +LZ4、ZSTD 数据压缩。其次，计算存储结合本地化+向量化执行。Presto 数据可能存储在 Hadoop 集群或者 HDFS 中，实时拉取数据进行计算。而 ClickHouse 计算存储本地化是指每一台计算机器存在本地 SSD 盘，只需要计算自己的数据，再进行节点合并。同时，LSM merge tree+Index。将数据写入 ClickHouse 之后，会在后台开始一个线程将数据进行 merge，做 Index 索引。如建常见的 DT 索引和小时级数据索引，以提高查询性能。第四，SIMD+LLVM 优化。SIMD 是单指令多数据集。第五，SQL 语法及 UDF 完善。ClickHouse 对此有很大需求。在数据分析或者维度下拽时需要更高的特性，如时间窗口的一部分功能点。

* Merge Tree：如下图所示。第一层为实时数据写入。后台进行每一层级数据的merge。merge 时会进行数据排序，做 Index 索引。
* ClickHouse Connector：ClickHouse 有两个概念，Local table 和Distributed table。一般是写 Local table ，读 Distributed table。ClickHouse 一般以 5~10w一个批次进行数据写入，5s一个周期。趣头条还实现了 RoundRobinClickHouseDataSource。
* BalancedClickHouseDataSource ：MySQL 中配置一个 IP 和端口号就可以写入数据，而 BalancedClickHouseDataSource 需要写 Local 表，因此必须要知道该集群有多少个 Local 表，每一个 Local 表的 IP 和端口号。如有一百台机器，需要将一百台机器的 IP 和端口号全部配置好，再进行写入。BalancedClickHouseDataSource 有两个 schedule。scheduleActualization和 scheduleConnectionsCleaning 。配置一百台机器的 IP 和端口号，会出现某些机器不连接或者服务不响应问题，scheduleActualization 会定期发现机器无法连接的问题，触发下线或删除 IP 等动作。scheduleConnectionsCleaning 会定期清理 ClickHouse 中无用的 http 请求。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/0A083D072127AC5FBD3118E34285F3A4.jpg)

* RoundRobinClickHouseDataSource：趣头条对BalancedClickHouseDataSource 进行加强的结果，实现了三个语义。testOnBorrow 设置为 true，尝试 ping 看能否获取连接。用 ClickHouse 写入时是一个 batch，再将 testOnReturn 设置为 false，testWhileIdel 设置为true，填入官方 scheduleActualization 和 scheduleConnectionsCleaning 的功能。ClickHouse 后台不断进行 merge，如果 insert 过快使后台 merge 速度变慢，跟不上 insert，出现报错。因此需要尽量不断往下写，等写完当前机器，再写下一个机器，以5s间隔进行写入，使 merge 速度能够尽量与 insert 速度保持一致。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/DE05C443D4A4173625103B4B55BC5ADC.jpg)

### 4.Backfill

Flink 导入 ClickHouse，在数据查询或展示报表时，会遇到一些问题，比如 Flink 任务出现故障、报错或数据反压等，或 ClickHouse 集群出现不可响应，zk 跟不上，insert 过快或集群负载等问题，这会导致整个任务出现问题。

如果流数据量突然暴增，启动 Flink 可能出现一段时间内不断追数据的情况，需要进行调整并行度等操作帮助 Flink 追数据。但这时已经出现数据积压，若还要加大 Flink 并发度处理数据，ClickHouse 限制 insert 不能过快，否则会导致恶性循环。因此当 Flink 故障或 ClickHouse 集群故障时，等待 ClickHouse 集群恢复后，Flink 任务从最新数据开始消费，不再追过去一段时间的数据，通过 Hive 将数据导入到 ClickHouse。

由于之前已经通过 Kafka 将数据实时落地到 Hive，通过 Hive 将数据写入 ClickHouse 中。ClickHouse 有分区，只需要将上一个小时的数据删除，导入 Hive 的一小时数据，就可以继续进行数据查询操作。Backfill 提供了 Flink 任务小时级容错以及 ClickHouse 集群小时级容错机制。

![趣头条基于 Flink+ClickHouse 构建实时数据分析平台](resources/6F3B2A4ED186521889B82D4B6E55B7CD.jpg)

未来发展与思考
-------

### 1.Connector SQL 化

目前， Flink-to-Hive 以及 Flink-to-ClickHouse 都是趣头条较为固化的场景，只需指定 HDFS 路径以及用户，其余过程都可以通过 SQL 化描述。

### 2.Delta lake

Flink 是流批一体计算引擎，但是没有流批一体的存储。趣头条会用 HBase、Kudu、Redis 等能够与 Flink 实时交互的 KV 存储进行数据计算。如计算新增问题，目前趣头条的方案是需要将 Hive 历史用户刷到 Redis 或 HBase 中，与 Flink 进行实时交互判断用户是否新增。

但因为 Hive 中的数据和 Redis 中的数据是存储为两份数据。其次 Binlog 抽取数据会涉及 delete 动作，Hbase，Kudu 支持数据修改，定期回到 Hive 中。带来的问题是 HBase，Kudu 中存在数据，Hive 又保存了一份数据，多出一份或多份数据。如果有流批一体的存储支持上述场景，当 Flink 任务过来，可以与离线数据进行实时交互，包括实时查询 Hive 数据等，可以实时判断用户是否新增，对数据进行实时修改、更新或 delete，也能支持 Hive 的批的动作存储。

未来，趣头条考虑对 Flink 做流批的存储，使 Flink 生态统一为流批结合。

> 作者介绍：王金海，10 年互联网历练，先后在唯品会负责用户画像系统，提供人群的个性化营销服务；饿了么担任架构师，负责大数据任务调度、元数据开发、任务画像等工作；现为趣头条数据中心平台负责人，负责大数据基础计算层（spark、presto、flink、clickhouse）、平台服务层（libra 实时计算、kepler 离线调度）、数据产品层（qe即时查询、horizon 数据报表、metadata 元数据、数据权限等）、以及团队建设。