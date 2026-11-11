package util;

import exception.ConfigMissingException;
import exception.ScoreException;

/**
 * 全局异常处理：按错误码输出友好提示。
 */
public final class ExceptionHandler {
    private ExceptionHandler() {
    }

    public static void handle(Exception e) {
        if (e instanceof ScoreException) {
            ScoreException se = (ScoreException) e;
            switch (se.getErrorCode()) {
                case ErrorCodes.SCORE_OUT_OF_RANGE:
                    System.out.println("[友好提示] 成绩必须在 0~100 之间，请重新录入。");
                    break;
                case ErrorCodes.STUDENT_NOT_FOUND:
                    System.out.println("[友好提示] 找不到该学号对应的学生，请核对后重试。");
                    break;
                case ErrorCodes.DUPLICATE_SCORE:
                    System.out.println("[友好提示] 该学生成绩已存在，如需修改请走更正流程。");
                    break;
                default:
                    System.out.println("[友好提示] 业务错误：" + se.getMessage());
            }
            return;
        }
        if (e instanceof ConfigMissingException) {
            System.out.println("[友好提示] 系统配置不完整，请联系管理员检查配置项。");
            return;
        }
        System.out.println("[友好提示] 系统繁忙，请联系管理员");
        System.out.println("  (内部日志) " + e.getClass().getSimpleName() + ": " + e.getMessage());
    }
}
