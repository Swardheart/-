package model;

/**
 * 学生实体：学号、姓名、成绩。
 */
public class StudentUser {
    private final String id;
    private String name;
    private Double score; // null 表示尚未录入

    public StudentUser(String id, String name) {
        this.id = id;
        this.name = name;
        this.score = null;
    }

    public StudentUser(String id, String name, double score) {
        this.id = id;
        this.name = name;
        this.score = score;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    /** 总分/成绩；未录入时返回 0，便于排序演示 */
    public double getTotal() {
        return score == null ? 0.0 : score;
    }

    public Double getScore() {
        return score;
    }

    public void setScore(double score) {
        this.score = score;
    }

    public boolean hasScore() {
        return score != null;
    }

    @Override
    public String toString() {
        return String.format("StudentUser{id='%s', name='%s', score=%s}",
                id, name, score == null ? "未录入" : String.format("%.2f", score));
    }
}
