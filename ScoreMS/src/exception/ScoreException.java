package exception;

/**
 * 成绩业务异常父类（受检异常）。
 * 所有可预期的业务错误均继承本类，强制调用方处理。
 */
public class ScoreException extends Exception {
    private final String errorCode;

    public ScoreException(String errorCode, String message) {
        super(errorCode + " " + message);
        this.errorCode = errorCode;
    }

    public ScoreException(String errorCode, String message, Throwable cause) {
        super(errorCode + " " + message, cause);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
