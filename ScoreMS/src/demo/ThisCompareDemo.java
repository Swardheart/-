package demo;

import java.util.Comparator;

/**
 * 验证 Lambda 与匿名类的 this 指向差异。
 */
public class ThisCompareDemo {
    private final String tag = "OuterInstance";

    public void run() {
        System.out.println("=== this 指向对比 ===");

        Comparator<String> anonymous = new Comparator<String>() {
            private final String tag = "AnonymousInner";

            @Override
            public int compare(String a, String b) {
                // 匿名类中 this 指向匿名类实例
                System.out.println("匿名类 this.tag = " + this.tag);
                System.out.println("匿名类 外部类.this.tag = " + ThisCompareDemo.this.tag);
                return a.compareTo(b);
            }
        };
        anonymous.compare("a", "b");

        Comparator<String> lambda = (a, b) -> {
            // Lambda 不引入新作用域，this 仍指向外部类实例
            System.out.println("Lambda this.tag = " + this.tag);
            return a.compareTo(b);
        };
        lambda.compare("a", "b");
    }
}
