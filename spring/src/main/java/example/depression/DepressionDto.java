package example.depression;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// 리액트가 보내는 입력값 ( 필드명은 팀원 FastAPI 와 동일해야 함 )
@Data @NoArgsConstructor @AllArgsConstructor
public class DepressionDto {
    private String gender;            // 성별 : Male / Female
    private Integer age;              // 나이
    private Integer academicPressure; // 학업 압박감 0~5
    private Double gpa;               // 학점 0~4.5
    private Integer studySatisfaction;// 학업 만족도 0~5
    private String sleepDuration;     // 수면 시간 구간
    private Double workStudyHours;    // 하루 공부/일 시간
    private Integer financialStress;  // 경제적 스트레스 1~5
}
