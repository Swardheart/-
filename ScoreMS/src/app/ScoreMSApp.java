package app;

import demo.ThisCompareDemo;
import exception.ConfigMissingException;
import exception.DuplicateScoreException;
import exception.ScoreException;
import exception.ScoreOutOfRangeException;
import exception.StudentNotFoundException;
import functional.ScoreFilter;
import model.StudentUser;
import service.ScoreService;
import util.ExceptionHandler;

import java.nio.file.Path;
import java.util.Arrays;
import java.util.Comparator;
import java.util.InputMismatchException;
import java.util.List;

/**
 * 实验十：Lambda 表达式与异常处理 —— 主演示程序。
 */
public class ScoreMSApp {

    public static void main(String[] args) {
        ScoreService service = new ScoreService();

        System.out.println("========== 任务1: Lambda 现代化改造 ==========");
        demoLambdaSort(service);
        demoScoreFilter(service);
        new ThisCompareDemo().run();
        demoLineCountShrink();

        System.out.println();
        System.out.println("========== 任务2: 业务异常体系 ==========");
        demoBusinessExceptions(service);
        demoExceptionChain(service);
        demoConfigMissing();

        System.out.println();
        System.out.println("========== 任务3: 录入流程异常兜底 ==========");
        runInputMatrix(service);
        demoFinallyAlwaysRuns(service);
        demoTryWithResources(service);

        System.out.println();
        System.out.println("========== 挑战: 全局错误处理 ==========");
        demoGlobalHandler();

        System.out.println();
        System.out.println("全部演示结束。累计录入尝试次数 = " + service.getInputAttemptCount());
    }

    /** 三个比较器：匿名类 → Lambda → 方法引用 */
    private static void demoLambdaSort(ScoreService service) {
        // 先录入一批成绩
        safeInput(service, "2024001", 88.5);
        safeInput(service, "2024002", 92.0);
        safeInput(service, "2024003", 55.0);
        safeInput(service, "2024004", 92.0);
        safeInput(service, "2024005", 73.5);

        StudentUser[] byAnon = service.getStudentsArray();
        // 实验九风格：匿名类（约 8~10 行模板）
        Arrays.sort(byAnon, new Comparator<StudentUser>() {
            @Override
            public int compare(StudentUser a, StudentUser b) {
                return Double.compare(b.getTotal(), a.getTotal());
            }
        });
        System.out.println("[匿名类] 总分降序: " + summarize(byAnon));

        StudentUser[] byLambda = service.getStudentsArray();
        service.sortByTotalDesc(byLambda);
        System.out.println("[Lambda ] 总分降序: " + summarize(byLambda));

        StudentUser[] byRef = service.getStudentsArray();
        Arrays.sort(byRef, Comparator.comparing(StudentUser::getTotal).reversed());
        System.out.println("[方法引用] 总分降序: " + summarize(byRef));

        StudentUser[] byName = service.getStudentsArray();
        service.sortByName(byName);
        System.out.println("[comparing] 姓名升序: " + summarize(byName));

        StudentUser[] byChain = service.getStudentsArray();
        service.sortByTotalThenName(byChain);
        System.out.println("[链式   ] 总分降序+姓名: " + summarize(byChain));
    }

    private static void demoScoreFilter(ScoreService service) {
        ScoreFilter fail = ScoreService.failFilter();                 // 筛不及格
        ScoreFilter excellent = ScoreService.excellentFilter();       // 筛90分以上（优秀）
        ScoreFilter pass = ScoreService.passFilter();                 // 合格

        System.out.println("不及格: " + service.filter(fail));
        System.out.println("优秀  : " + service.filter(excellent));
        System.out.println("合格  : " + service.filter(pass));
        System.out.println("合格且非优秀: " + service.filter(pass.and(excellent.negate())));
    }

    private static void demoLineCountShrink() {
        int anonLines = 8;   // 单个匿名 Comparator 约 8 行
        int lambdaLines = 1; // Lambda 一行
        double shrink = (anonLines - lambdaLines) * 100.0 / anonLines;
        System.out.printf("模板行数缩减: 匿名类约 %d 行 → Lambda %d 行，缩减约 %.0f%%%n",
                anonLines, lambdaLines, shrink);
    }

    private static void demoBusinessExceptions(ScoreService service) {
        try {
            service.inputScore("2024001", 120);
        } catch (ScoreOutOfRangeException e) {
            System.out.println("捕获越界: " + e.getMessage());
        } catch (ScoreException e) {
            System.out.println("其他业务异常: " + e.getMessage());
        }

        try {
            service.inputScore("9999999", 80);
        } catch (StudentNotFoundException e) {
            System.out.println("捕获学号不存在: " + e.getMessage());
        } catch (ScoreException e) {
            System.out.println("其他业务异常: " + e.getMessage());
        }

        try {
            service.inputScore("2024001", 66); // 已录入过
        } catch (DuplicateScoreException e) {
            System.out.println("捕获重复录入: " + e.getMessage());
        } catch (ScoreException e) {
            System.out.println("其他业务异常: " + e.getMessage());
        }
    }

    private static void demoExceptionChain(ScoreService service) {
        try {
            service.loadRosterFromFile(Path.of("testdata/no-such-file.txt"));
        } catch (ScoreException e) {
            System.out.println("异常链外层: " + e.getMessage());
            Throwable cause = e.getCause();
            if (cause != null) {
                System.out.println("异常链原因: " + cause.getClass().getName() + " - " + cause.getMessage());
            }
        }
    }

    private static void demoConfigMissing() {
        try {
            ScoreService s = new ScoreService();
            s.loadConfig("db.url");
        } catch (ConfigMissingException e) {
            System.out.println("非受检配置异常: " + e.getMessage());
        }
    }

    /**
     * 15 条用例矩阵：正常 / 边界 / 非法 / 业务异常。
     */
    private static void runInputMatrix(ScoreService service) {
        // 使用全新服务，避免与任务1成绩冲突；另建学生便于测重复录入
        ScoreService svc = new ScoreService();
        Object[][] cases = {
                // 编号, stuId, score(Object), 预期描述
                {"T01", "2024001", 85.0, "正常录入"},
                {"T02", "2024002", 0.0, "边界下限0"},
                {"T03", "2024003", 100.0, "边界上限100"},
                {"T04", "2024004", 0.01, "边界近0"},
                {"T05", "2024005", 99.99, "边界近100"},
                {"T06", "2024001", -1.0, "负数越界"},
                {"T07", "2024001", 101.0, "超100越界"},
                {"T08", "2024001", "abc", "非数字→InputMismatch模拟"},
                {"T09", "2024001", null, "null成绩"},
                {"T10", "8888888", 70.0, "学号不存在"},
                {"T11", "2024001", 90.0, "重复录入"},
                {"T12", null, 60.0, "学号为null"},
                {"T13", "  ", 60.0, "学号空白"},
                {"T14", "2024002", 50.0, "重复录入已有成绩的学生"},
                {"T15", "2024003", Double.NaN, "NaN非法"},
        };

        int pass = 0;
        for (Object[] c : cases) {
            String id = (String) c[0];
            String stuId = (String) c[1];
            Object scoreObj = c[2];
            String expect = (String) c[3];
            boolean ok = runOneInput(svc, stuId, scoreObj);
            if (ok) {
                pass++;
            }
            System.out.printf("%s | 输入(%s, %s) | 预期:%s | %s%n",
                    id, stuId, scoreObj, expect, ok ? "未崩溃✓" : "异常未兜底✗");
        }
        System.out.printf("用例通过率(不崩溃): %d/%d = %.1f%%%n", pass, cases.length, pass * 100.0 / cases.length);
    }

    /** 录入主流程：多 catch + finally 计数 */
    private static boolean runOneInput(ScoreService service, String stuId, Object scoreObj) {
        try {
            if (scoreObj instanceof String) {
                // 模拟 Scanner 读到非数字
                throw new InputMismatchException("成绩必须是数字");
            }
            if (scoreObj == null) {
                service.inputScore(stuId, (Double) null);
            } else {
                service.inputScore(stuId, ((Number) scoreObj).doubleValue());
            }
            System.out.print("  → 录入成功; ");
            return true;
        } catch (InputMismatchException e) {
            System.out.print("  → 成绩必须是数字; ");
            return true;
        } catch (ScoreOutOfRangeException | DuplicateScoreException e) {
            System.out.print("  → 业务错误：" + e.getMessage() + "; ");
            return true;
        } catch (StudentNotFoundException e) {
            System.out.print("  → 业务错误：" + e.getMessage() + "; ");
            return true;
        } catch (Exception e) {
            System.out.print("  → 兜底：" + e.getMessage() + "; ");
            return true;
        } finally {
            service.markInputAttempted();
            System.out.println("本次录入结束");
        }
    }

    /** 验证 return 后 finally 仍执行 */
    private static void demoFinallyAlwaysRuns(ScoreService service) {
        System.out.println("验证 return 后 finally:");
        String result = methodWithFinallyReturn(service);
        System.out.println("方法返回值 = " + result + "，计数 = " + service.getInputAttemptCount());
    }

    private static String methodWithFinallyReturn(ScoreService service) {
        try {
            return "try中的return";
        } finally {
            service.markInputAttempted();
            System.out.println("  finally 在 return 之后仍然执行了");
        }
    }

    private static void demoTryWithResources(ScoreService service) {
        try {
            List<String> lines = service.loadRosterFromFile(Path.of("testdata/roster.txt"));
            System.out.println("try-with-resources 读取花名册: " + lines);
        } catch (ScoreException e) {
            ExceptionHandler.handle(e);
        }
    }

    private static void demoGlobalHandler() {
        ExceptionHandler.handle(new ScoreOutOfRangeException(120));
        ExceptionHandler.handle(new StudentNotFoundException("0000"));
        ExceptionHandler.handle(new DuplicateScoreException("2024001"));
        ExceptionHandler.handle(new ConfigMissingException("db.url"));
        ExceptionHandler.handle(new RuntimeException("未知故障"));
    }

    private static void safeInput(ScoreService service, String id, double score) {
        try {
            service.inputScore(id, score);
            service.markInputAttempted();
        } catch (ScoreException e) {
            System.out.println("预置成绩失败: " + e.getMessage());
        }
    }

    private static String summarize(StudentUser[] arr) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) {
                sb.append(", ");
            }
            sb.append(arr[i].getName()).append("=").append(arr[i].getTotal());
        }
        return sb.append("]").toString();
    }
}
