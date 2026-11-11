package exception;

/**
 * 配置缺失——程序缺陷级别，使用非受检异常（RuntimeException）。
 * 选择标准：调用方通常无法恢复，应尽早失败暴露问题，而非强迫每层声明 throws。
 */
public class ConfigMissingException extends RuntimeException {
    public ConfigMissingException(String configKey) {
        super("E2001 配置缺失: " + configKey + "，请检查系统配置");
    }
}
