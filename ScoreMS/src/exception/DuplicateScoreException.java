package exception;

/**
 * 重复录入成绩。
 */
public class DuplicateScoreException extends ScoreException {
    public DuplicateScoreException(String stuId) {
        super("E1003", "学号 " + stuId + " 已录入成绩，禁止重复录入");
    }
}
