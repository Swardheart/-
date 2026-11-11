package functional;

import model.StudentUser;

/**
 * 自定义函数式接口：对学生成绩做过滤判定。
 * 只有一个抽象方法，因此可用 Lambda / 方法引用实现。
 */
@FunctionalInterface
public interface ScoreFilter {
    boolean test(StudentUser s);

    /** 默认方法：与另一个过滤器做 AND 组合 */
    default ScoreFilter and(ScoreFilter other) {
        return s -> this.test(s) && other.test(s);
    }

    /** 默认方法：取反 */
    default ScoreFilter negate() {
        return s -> !this.test(s);
    }
}
