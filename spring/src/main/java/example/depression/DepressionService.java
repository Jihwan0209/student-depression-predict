package example.depression;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class DepressionService {
    // 접속 중인 리액트 목록
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    private final WebClient webClient = WebClient.builder().build();
    private final String fastApiUrl = "http://localhost:8000/api/predict/stream";

    // 구독 : 제한시간 1시간
    public SseEmitter subscribe(){
        SseEmitter emitter = new SseEmitter( 60 * 60 * 1000L );
        emitters.add( emitter );
        emitter.onCompletion( () -> emitters.remove( emitter ) );
        emitter.onTimeout( () -> emitters.remove( emitter ) );
        emitter.onError( (e) -> emitters.remove( emitter ) );
        return emitter;
    }

    // 접속 중인 모든 리액트에게 전송 ( 이벤트 이름 + 데이터 )
    private void send( String name , String data ){
        for( SseEmitter emitter : emitters ){
            try{
                emitter.send( SseEmitter.event().name( name ).data( data ) );
            }catch( Exception e ){ emitters.remove( emitter ); }
        }
    }

    // 예측 : FastAPI 스트리밍을 호출하고, 오는 이벤트(progress/result/error/done)를 이름 그대로 리액트로 중계
    public void predict( Map<String,Object> data ){
        webClient.post()
                .uri( fastApiUrl )
                .contentType( MediaType.APPLICATION_JSON )
                .bodyValue( data )
                .retrieve()
                .bodyToFlux( new ParameterizedTypeReference<ServerSentEvent<String>>() {} )   // 이벤트 이름까지 받기
                .subscribe(
                    sse -> send( sse.event() != null ? sse.event() : "message" , sse.data() != null ? sse.data() : "" ),
                    error -> {                               // FastAPI 가 꺼져 있는 등 오류
                        send( "error" , "{\"code\":\"SERVER_DOWN\",\"message\":\"AI 서버 연결 실패\"}" );
                        send( "done" , "{}" );
                    }
                );
    }
}
