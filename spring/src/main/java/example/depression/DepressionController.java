package example.depression;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.RequiredArgsConstructor;

@RestController @RequestMapping("/api/depression")
@RequiredArgsConstructor
@CrossOrigin( origins = "http://localhost:5173" )
public class DepressionController {
    private final DepressionService depressionService;

    // 1. 구독 : 리액트가 접속해 두면 진행 상태/결과가 실시간으로 전달됨 (SSE)
    @GetMapping( value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE )
    public SseEmitter subscribe(){
        return depressionService.subscribe();
    }

    // 2. 예측 요청 : 입력값을 FastAPI 로 넘김 ( 결과는 위 구독으로 흘러감 )
    @PostMapping("/predict")
    public void predict( @RequestBody DepressionDto depressionDto ){
        depressionService.predict( depressionDto );
    }
}
