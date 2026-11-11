package exception;

/**
 * 学号不存在。
 */
public class StudentNotFoundException extends ScoreException {
    public StudentNotFoundException(String stuId) {
        super("E1002", "学号不存在: " + stuId);
    }
}
