package service;

import exception.ConfigMissingException;
import exception.DuplicateScoreException;
import exception.ScoreException;
import exception.ScoreOutOfRangeException;
import exception.StudentNotFoundException;
import functional.ScoreFilter;
import model.StudentUser;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 成绩服务：录入、排序、过滤、配置加载。
 */
public class ScoreService {
    private final Map<String, StudentUser> students = new LinkedHashMap<>();
    private int inputAttemptCount = 0;
    private String dataDir;

    public ScoreService() {
        // 预置若干学生，便于演示
        addStudent(new StudentUser("2024001", "张三"));
        addStudent(new StudentUser("2024002", "李四"));
        addStudent(new StudentUser("2024003", "王五"));
        addStudent(new StudentUser("2024004", "赵六"));
        addStudent(new StudentUser("2024005", "钱七"));
    }

    public void addStudent(StudentUser s) {
        students.put(s.getId(), s);
    }

    public StudentUser[] getStudentsArray() {
        return students.values().toArray(new StudentUser[0]);
    }

    public List<StudentUser> getStudents() {
        return new ArrayList<>(students.values());
    }

    public int getInputAttemptCount() {
        return inputAttemptCount;
    }

    public void markInputAttempted() {
        inputAttemptCount++;
    }

    /**
     * 录入成绩：校验范围、学号存在性、是否重复。
     * 受检异常强制调用方处理。
     */
    public void inputScore(String stuId, double score)
            throws ScoreOutOfRangeException, StudentNotFoundException, DuplicateScoreException {
        if (stuId == null || stuId.isBlank()) {
            throw new StudentNotFoundException(String.valueOf(stuId));
        }
        if (Double.isNaN(score) || score < 0 || score > 100) {
            throw new ScoreOutOfRangeException(score);
        }
        StudentUser stu = students.get(stuId);
        if (stu == null) {
            throw new StudentNotFoundException(stuId);
        }
        if (stu.hasScore()) {
            throw new DuplicateScoreException(stuId);
        }
        stu.setScore(score);
    }

    /** 包装类型重载：显式处理 null 成绩 */
    public void inputScore(String stuId, Double score)
            throws ScoreOutOfRangeException, StudentNotFoundException, DuplicateScoreException {
        if (score == null) {
            throw new ScoreOutOfRangeException(Double.NaN);
        }
        inputScore(stuId, score.doubleValue());
    }

    /**
     * 加载配置；缺失时抛出非受检异常。
     */
    public void loadConfig(String configKey) {
        if (configKey == null || configKey.isBlank()) {
            throw new ConfigMissingException(String.valueOf(configKey));
        }
        if (!"data.dir".equals(configKey) && !"app.name".equals(configKey)) {
            throw new ConfigMissingException(configKey);
        }
        if ("data.dir".equals(configKey)) {
            this.dataDir = "testdata";
        }
    }

    public String getDataDir() {
        return dataDir;
    }

    /**
     * 用异常链包装底层 IOException → ScoreException。
     */
    public List<String> loadRosterFromFile(Path path) throws ScoreException {
        Objects.requireNonNull(path, "path");
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.isBlank()) {
                    lines.add(line.trim());
                }
            }
            return lines;
        } catch (IOException e) {
            throw new ScoreException("E1002", "读取花名册失败: " + path, e);
        }
    }

    /** 按总分降序 —— Lambda */
    public void sortByTotalDesc(StudentUser[] arr) {
        Arrays.sort(arr, (a, b) -> Double.compare(b.getTotal(), a.getTotal()));
    }

    /** 按总分升序 —— 方法引用 + Comparator.comparing */
    public void sortByTotalAsc(StudentUser[] arr) {
        Arrays.sort(arr, Comparator.comparing(StudentUser::getTotal));
    }

    /** 按姓名字典序 —— Comparator.comparing 链式 */
    public void sortByName(StudentUser[] arr) {
        Arrays.sort(arr, Comparator.comparing(StudentUser::getName));
    }

    /** 总分降序再用姓名打破平局 —— comparing 链式 */
    public void sortByTotalThenName(StudentUser[] arr) {
        Arrays.sort(arr, Comparator.comparing(StudentUser::getTotal).reversed()
                .thenComparing(StudentUser::getName));
    }

    /**
     * 使用自定义函数式接口过滤学生。
     */
    public List<StudentUser> filter(ScoreFilter filter) {
        List<StudentUser> result = new ArrayList<>();
        for (StudentUser s : students.values()) {
            if (filter.test(s)) {
                result.add(s);
            }
        }
        return result;
    }

    /** 筛不及格：成绩已录入且 &lt; 60 */
    public static ScoreFilter failFilter() {
        return s -> s.hasScore() && s.getTotal() < 60;
    }

    /** 筛优秀：成绩 &gt;= 90 */
    public static ScoreFilter excellentFilter() {
        return s -> s.hasScore() && s.getTotal() >= 90;
    }

    /** 筛合格：成绩 &gt;= 60 */
    public static ScoreFilter passFilter() {
        return s -> s.hasScore() && s.getTotal() >= 60;
    }
}
