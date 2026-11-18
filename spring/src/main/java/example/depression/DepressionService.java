package example.depression;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class DepressionService {
    // 접속 중인 리액트 목록 ( 구분번호(id) -> 연결 ) : 요청한 사람에게만 보내기 위해 Map 사용
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    private final WebClient webClient = WebClient.builder().build();
    private final String fastApiUrl = "http://localhost:8000/api/predict/stream";

    // 구독 : 리액트가 보낸 id 로 연결 저장
    public SseEmitter subscribe( String id ){
        SseEmitter emitter = new SseEmitter( 60 * 60 * 1000L );
        emitters.put( id, emitter );
        emitter.onCompletion( () -> emitters.remove( id, emitter ) );
        emitter.onTimeout( () -> emitters.remove( id, emitter ) );
        emitter.onError( (e) -> emitters.remove( id, emitter ) );
        return emitter;
    }

    // 해당 id 의 리액트에게만 전송 ( 리액트에서 addEventListener('predict') 로 받음 )
    private void send( String id , String message ){
        SseEmitter emitter = emitters.get( id );
        if( emitter == null ) return;   // 접속이 끊긴 id 면 보내지 않음
        try{
            emitter.send( SseEmitter.event().name("predict").data( message ) );
        }catch( Exception e ){ emitters.remove( id, emitter ); }
    }

    // 예측 : FastAPI 스트리밍 호출 -> 오는 데이터를 한 건씩 요청한 리액트(id)로 전달
    public void predict( String id , DepressionDto depressionDto ){
        webClient.post()
                .uri( fastApiUrl )
                .contentType( MediaType.APPLICATION_JSON )
                .bodyValue( depressionDto )
                .retrieve()
                .bodyToFlux( String.class )                  // 한 건씩 받기 ( bodyToMono 는 한 번에 1건 )
                .subscribe(
                    message -> send( id , message ),
                    error -> send( id , "{\"code\":\"SERVER_DOWN\",\"message\":\"AI 서버 연결 실패\"}" )
                );
    }
}
