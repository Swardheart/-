package exception;

/**
 * 成绩越界：合法范围为 [0, 100]。
 */
public class ScoreOutOfRangeException extends ScoreException {
    public ScoreOutOfRangeException(double score) {
        super("E1001", "成绩越界: " + score + "，合法范围0-100");
    }
}
