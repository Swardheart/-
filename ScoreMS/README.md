# 实验十：Lambda 表达式与异常处理（ScoreMS）

学生成绩管理系统的 Lambda 现代化改造与业务异常体系。

## 目录结构

```
ScoreMS/
├── src/
│   ├── app/ScoreMSApp.java          # 主程序：任务1~3 + 挑战演示
│   ├── demo/ThisCompareDemo.java    # Lambda vs 匿名类 this 对比
│   ├── exception/                   # ScoreException 家族 + ConfigMissing
│   ├── functional/ScoreFilter.java  # 自定义函数式接口
│   ├── model/StudentUser.java
│   ├── service/ScoreService.java
│   └── util/ErrorCodes.java, ExceptionHandler.java
└── testdata/roster.txt
```

## 编译与运行

在 `ScoreMS` 目录下执行：

```bash
javac -encoding UTF-8 -d out $(find src -name '*.java')
cp -r testdata out/
cd out && java app.ScoreMSApp
```

## 任务对照

| 任务 | 实现要点 |
|------|----------|
| 任务1 | 三个比较器 Lambda / `Comparator.comparing`；`ScoreFilter` 筛不及格与优秀；this 对比 |
| 任务2 | `ScoreException` 及三子类（受检）+ `ConfigMissingException`（非受检）；IO 异常链 |
| 任务3 | 多 catch + finally 计数；15 条用例矩阵；try-with-resources |
| 挑战 | 错误码 E1001~E2001；`ExceptionHandler.handle` |

## 错误码

- E1001 成绩越界
- E1002 学号不存在 / 花名册读取失败
- E1003 重复录入
- E2001 配置缺失
