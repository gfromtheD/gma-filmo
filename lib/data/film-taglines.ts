// Taglines (hero hook) and synopses for all 80 films.
// tagline → short Netflix-style hook shown in the Hero banner
// synopsis → full description shown in the detail page Sinopsis section

export interface FilmContent {
  readonly tagline: string;
  readonly synopsis: string;
}

export const FILM_CONTENT: Readonly<Record<string, FilmContent>> = {
  "a-cada-cual-su-espera": {
    tagline: "Siete minutos para preguntarte qué estás esperando — y si vale la pena.",
    synopsis: "En una espera interminable, varios personajes revelan quiénes son cuando el tiempo se detiene. Una reflexión animada sobre la paciencia, la identidad y lo que decidimos hacer mientras el mundo no nos necesita.",
  },
  "ancronia-95": {
    tagline: "En Yuboskia, la fe no une — divide, sangra y quema.",
    synopsis: "La región de Yuboskia lleva décadas fracturada por un conflicto religioso que nadie sabe cómo empezó y nadie sabe cómo terminar. Un corto que retrata el fanatismo como el arma más antigua y más vigente.",
  },
  "ano-1-antes-de-covid": {
    tagline: "El año que no sabíamos que era el último de su clase.",
    synopsis: "Un repaso nostálgico y animado del mundo tal como era en el año previo a la pandemia — cuando lo cotidiano aún no era extraordinario y nadie guardaba nada por si acaso. Un documento de lo que perdimos sin saberlo.",
  },
  "caso-6811-el-extrano-mundo-de-gumball": {
    tagline: "Esta cinta fue encontrada. Quizás debería seguir perdida.",
    synopsis: "Un VHS digitalizado del programa 'El extraño mundo de Gumball' cuya visualización queda bajo responsabilidad total del espectador. El creador se desvincula de cualquier daño físico o psicológico resultante.",
  },
  "cazando-perros": {
    tagline: "En el espacio nadie escucha tu estómago. Las presas sí.",
    synopsis: "Un astronauta hambriento y su fiel compañero robot emprenden una expedición de caza espacial que resulta mucho más complicada de lo previsto. Una aventura cósmica sobre el instinto de supervivencia y la amistad improbable.",
  },
  "ceguera-temporal-2": {
    tagline: "No ver no es lo mismo que no entender. A veces es justo lo contrario.",
    synopsis: "En menos de treinta segundos, una pérdida momentánea de visión desencadena una cascada de percepciones que el ojo no podría haber captado. Segunda entrega de la exploración de Caivano sobre lo que revela la oscuridad.",
  },
  "chi-no-wadachi-fan-animation": {
    tagline: "El amor de una madre no tiene límites. Eso es exactamente lo que debería asustarte.",
    synopsis: "Animación de fan basada en el manga de Shūzō Oshimi sobre la relación inquietante entre una madre y su hijo. Una pieza que captura la tensión visceral del original con una estética propia.",
  },
  "control-mental": {
    tagline: "Cuando tu mente ya no es tuya, ¿qué queda que defender?",
    synopsis: "Una criatura ejerce un control absoluto sobre la mente de otra en un juego de dominación que borra los límites entre voluntad y obediencia. Un corto que explora el poder como adicción y la identidad como territorio conquistable.",
  },
  "cuco": {
    tagline: "Sigue existiendo aunque ya no le tengas miedo. Eso lo hace más peligroso.",
    synopsis: "El cuco emerge de las sombras familiares — debajo de la cama, dentro del armario, en el silencio de las tres de la mañana. Un corto que recupera el miedo ancestral de la infancia y lo convierte en algo que ningún adulto puede ignorar.",
  },
  "curvilinea": {
    tagline: "Todo lo que existe sigue una curva. Solo hay que aprender a verla.",
    synopsis: "Una exploración audiovisual de la línea curva como unidad mínima del movimiento, la vida y la forma. Un corto que encuentra en la geometría más simple una complejidad infinita.",
  },
  "dios-hazme-alto-y-no-me-la-jalo-en-4-semanas": {
    tagline: "Antes de la civilización, hubo impulso. Lo demás vino después.",
    synopsis: "En un mundo primitivo, un homínido cede a sus instintos más oscuros y descubre que la violencia y el deseo autodestructivo no tienen consecuencias — o eso cree. Una sátira prehistórica sobre la naturaleza humana que no ha cambiado tanto.",
  },
  "dualidad": {
    tagline: "No existe la luz sin su sombra. No existe el tú sin el otro.",
    synopsis: "Dos fuerzas opuestas navegan un universo donde cada decisión carga el peso de su contraria. Un corto de cuatro minutos que explora la dualidad como condición irrenunciable de la existencia.",
  },
  "e-toro": {
    tagline: "En stop-motion, una pregunta que el mundo prefiere no hacer: ¿eres cosmos o ganado?",
    synopsis: "Desarrollado en técnica stop-motion durante el encierro pandémico, este corto reflexiona sobre el pensamiento crítico truncado y la urgencia de reconocerse como individuo en un mundo que prefiere la masa.",
  },
  "el-cine-cobra-vida": {
    tagline: "Las imágenes llevan décadas mirándote. Hoy deciden actuar.",
    synopsis: "Las películas abandonan la pantalla y el cine se convierte en algo más que una proyección — en una entidad con voluntad propia. Un cortometraje metafílmico que cuestiona quién controla realmente la narrativa.",
  },
  "el-lenguaje-es-matematico": {
    tagline: "Cada frase que pronuncias es una ecuación. Nunca fallas la misma dos veces.",
    synopsis: "Un viaje conceptual de veintisiete segundos por la estructura matemática subyacente al lenguaje humano, donde cada silencio es una variable y cada palabra una operación. Breve, preciso, inevitablemente correcto.",
  },
  "el-llamado-de-la-tierra": {
    tagline: "Hay una voz que viene del suelo. Pocos la escuchan. Menos aún la responden.",
    synopsis: "La tierra emite una señal dirigida a quienes saben escuchar. Un viajero recibe ese llamado y emprende un camino de transformación que lo lleva más lejos de lo que cualquier mapa podría indicar.",
  },
  "el-otro-choque": {
    tagline: "Dos conductores, una carretera, un final que los dos eligieron.",
    synopsis: "En una carretera desierta, dos vehículos avanzan desde extremos opuestos sin ninguna intención de esquivarse. En treinta y un segundos, el corto examina la complicidad silenciosa que existe entre quienes buscan la catástrofe.",
  },
  "el-ser-mas-debil": {
    tagline: "Una oportunidad. Una decisión. El mal menor nunca fue tan difícil de elegir.",
    synopsis: "Atrapado en una rutina que lo aplasta, un trabajador finalmente tiene ante sí la oportunidad de cambiarlo todo. Pero cambiar todo tiene un precio, y elegir el mal menor resulta ser la prueba más dura de su vida.",
  },
  "el-ultimo-futuro": {
    tagline: "En el páramo que quedó, un robot busca lo que los humanos dejaron atrás.",
    synopsis: "Solo, en un paisaje devastado, un robot recorre los restos de una civilización desaparecida buscando cualquier rastro de humanidad. Un corto sobre la soledad, la memoria y lo que perdura cuando todo lo demás se va.",
  },
  "en-el-desierto": {
    tagline: "La taberna equivocada. La noche equivocada. La historia que no debería contarse.",
    synopsis: "Un nómada del desierto acaba en el lugar menos indicado en el momento menos indicado. Lo que sigue es una historia de supervivencia, honor y las deudas que se pagan con sangre en los lugares donde no llegan las leyes.",
  },
  "es-solo-un-sueno": {
    tagline: "Las instrucciones más absurdas siempre vienen de quien más quieres.",
    synopsis: "Un padre transmite órdenes a su hijo con una lógica completamente surreal que, de alguna manera, tiene todo el sentido del mundo. Un corto íntimo y extraño sobre la herencia involuntaria que dejamos a quienes amamos.",
  },
  "escarnio": {
    tagline: "Una acción. Repetida hasta el límite. ¿Cuándo se convierte en saña?",
    synopsis: "Un experimento visual que toma una acción simple y la repite hasta que el espectador ya no sabe si está ante una broma o una crueldad. Un corto que explora los bordes difusos entre el juego y el daño.",
  },
  "fantaso4": {
    tagline: "El dios de las fantasías imposibles despertó durante el encierro. Lo que vino después fue culpa suya.",
    synopsis: "Fantaso, el Oniro encargado de los sueños inanimados, hermano de Morfeo, aprovechó la quietud de la pandemia para sembrar fantasías que confundieron lo real con lo deseado. Un corto mitológico sobre lo que inventamos cuando no podemos salir.",
  },
  "fe-faith": {
    tagline: "La fe no necesita pruebas. Eso es exactamente lo que la hace peligrosa.",
    synopsis: "Una exploración animada del concepto de fe desde sus dimensiones religiosa, personal y cósmica. Un minuto y medio que pregunta en qué creemos cuando todo lo demás falla — y si eso que creemos nos salva o nos hunde.",
  },
  "flores-de-agua": {
    tagline: "Nacen en el agua. Duran lo que dura un reflejo. Pero dejan huella.",
    synopsis: "En la superficie calma del agua florecen formas que no deberían existir. Una meditación visual sobre lo efímero, lo que no puede tocarse y la belleza que persiste precisamente porque no dura.",
  },
  "genesis-animatic": {
    tagline: "Antes del primer trazo hay un segundo de silencio absoluto. Ahí empieza todo.",
    synopsis: "Un animatic que recorre el momento primigenio de la creación — no el bíblico, sino el personal. El instante en que el artista decide que algo que no existe debería existir y lo hace existir con las manos.",
  },
  "guerra-en-sarilla": {
    tagline: "Una isla pequeña. Una independencia enorme. Una guerra que nadie ganó.",
    synopsis: "La pequeña isla de Sarilla lleva décadas reclamando su independencia colonial. Este corto retrata el conflicto armado resultante sin héroes ni villanos claros, solo personas atrapadas en una historia que empezó antes de que nacieran.",
  },
  "higiene-de-sueno": {
    tagline: "Para dormir mejor, primero hay que entender por qué no puedes.",
    synopsis: "Siguiendo a un personaje en su camino hacia una mejor calidad de sueño, este corto convierte la ciencia del descanso en una aventura animada accesible y genuinamente útil. El mensaje es claro: dormir bien no es un lujo, es una decisión.",
  },
  "hijo-natural": {
    tagline: "Creció sin que nadie le explicara de dónde venía. Eso lo explica todo.",
    synopsis: "Un hijo navega la tensión irresuelta entre el mundo que lo formó y la naturaleza que siempre lo llamó. Seis minutos que exploran la identidad construida en la ausencia y lo que significa pertenecer a algo cuando nadie te lo enseñó.",
  },
  "huas-huas": {
    tagline: "Hay mundos que no necesitan traducción. Solo atención.",
    synopsis: "Un viaje sonoro y visual hacia una cosmología propia donde lo sagrado y lo cotidiano comparten el mismo espacio. Un corto que habla un idioma que no se aprende — se reconoce.",
  },
  "impulso": {
    tagline: "Antes de pensar, ya actuaste. Así es el impulso. Así son sus costos.",
    synopsis: "En el instante anterior al arrepentimiento existe una fracción de segundo donde el impulso toma el control. Este corto vive en ese instante y examina con honestidad lo que dejamos a su paso.",
  },
  "infinity-projections": {
    tagline: "Un día en la tabla. Una vida en la memoria. El presente siempre se mueve.",
    synopsis: "A través de un día de skate, un personaje dialoga con su inconsciente y los recuerdos que emergen sin invitación. Una exploración íntima de cómo el cuerpo en movimiento libera lo que la mente prefiere guardar.",
  },
  "kalle-sonrisa": {
    tagline: "Kalle sonríe. Kalle siempre sonríe. Eso debería preocuparte.",
    synopsis: "Kalle carga el peso de una sonrisa que ya no le pertenece. Un retrato animado de cuatro minutos sobre la fatiga emocional crónica, el esfuerzo invisible de parecer bien y lo que se rompe cuando nadie está mirando.",
  },
  "la-banana-tuerta-de-gamp": {
    tagline: "Una compilación de lo que pasa cuando el absurdo se convierte en método artístico.",
    synopsis: "Criaturas nefastas protagonizan una serie de cuentos que desafían toda lógica narrativa convencional. Perturbadora, incómoda y completamente deliberada, esta obra de Gamp lleva el absurdo al límite para ver qué hay del otro lado.",
  },
  "la-fabrica-de-desahuciados": {
    tagline: "La guerra terminó. El robot, no.",
    synopsis: "Diseñado para destruir, un robot hábil en todas las técnicas bélicas descubre que la paz no tiene manual de instrucciones. Tras fracasar en encontrar un nuevo propósito, toma la decisión más valiente posible: desarmarse.",
  },
  "la-historia-mas-larga": {
    tagline: "La historia más larga que verás hoy dura veintidós segundos. Cronométrala.",
    synopsis: "Un corto que juega con la ironía de su propio título: veintidós segundos que pretenden contener más de lo que cualquier historia larga podría. Lo consigue.",
  },
  "la-nieve-que-mata": {
    tagline: "La nieve no mata de golpe. Primero adormece. Luego convences.",
    synopsis: "Una tormenta que no es meteorológica — es existencial. En veinticinco segundos, la nieve cae sobre todo lo que creíamos saber sobre el calor humano y la voluntad de sobrevivir.",
  },
  "laqu": {
    tagline: "No tiene título que puedas pronunciar. Tiene algo que sí puedes sentir.",
    synopsis: "Un experimento visual y sonoro que rechaza la narrativa lineal para construir algo más cercano a un estado mental que a una historia. Treinta y cinco segundos que se quedan más tiempo del que duran.",
  },
  "light-life": {
    tagline: "Primero llega la luz. Después llega todo lo que quiere vivir en ella.",
    synopsis: "Luz y vida como conceptos que se persiguen mutuamente a lo largo de cinco minutos de animación. Un corto sobre la dependencia mutua entre lo que ilumina y lo que necesita ser iluminado para existir.",
  },
  "limbo": {
    tagline: "Sin esperanza, sin salida — pero con suficiente energía para seguir cayendo.",
    synopsis: "Una visión surrealista y absurda del día a día de la juventud venezolana: sin futuro claro, resignada a lo que hay, atrapada en un limbo que no eligió pero que ha aprendido a habitar. Incómodo porque es real.",
  },
  "llevame-al-rio": {
    tagline: "Llevan siglos cantándole al río. Esta noche, el río responde.",
    synopsis: "Dos personajes recorren un camino de transición guiados por la canción de La Llorona hacia una figura misteriosa. Realizado en técnica cut-out con texturas de madera, manta y papel, una animación que se siente como un sueño recordado.",
  },
  "los-origenes-de-palo-alzado": {
    tagline: "Todo barrio tiene una leyenda. La de Palo Alzado nunca debió contarse.",
    synopsis: "El relato de cómo surgió el barrio ficticio de Palo Alzado — sus fundadores, sus primeras luchas y los secretos que quedaron enterrados en sus calles. Una historia de origen que explica por qué algunos lugares llevan cicatrices.",
  },
  "mal-viaje": {
    tagline: "Un mate. Una visión. Un viaje que nadie pidió.",
    synopsis: "La protagonista toma un mate con algo raro dentro y lo que sigue no tiene explicación racional. Diecinueve segundos de alucinación animada que plantean la pregunta fundamental: ¿quién te hace el mate?",
  },
  "maquinas-de-guerra": {
    tagline: "Construida para destruir, busca una razón para existir en la paz.",
    synopsis: "Un robot de guerra altamente capacitado se encuentra desorientado cuando el conflicto termina. Tras múltiples intentos fallidos de encontrar su lugar en un mundo que ya no la necesita para lo que fue diseñada, toma la decisión más difícil.",
  },
  "me-hice-el-pendejo-todo-el-ano-y-no-iba-a-participar-pero-al-final-si-aso-que-hice-esta-mamada": {
    tagline: "Un año de procrastinación. Un corto de pánico. Resultado: genuino.",
    synopsis: "Dragocape evitó participar durante todo el año, hasta que la presión de último momento produjo exactamente esto. Una obra honesta sobre la procrastinación, el síndrome del impostor y lo que pasa cuando finalmente te rindes ante la fecha límite.",
  },
  "medianoche": {
    tagline: "La medianoche no es un horario. Es otro mundo superpuesto al tuyo.",
    synopsis: "A medianoche, la ciudad pertenece a otros. Un personaje descubre qué — o quién — habita el espacio entre el último y el primer tren, en esa hora muerta que la mayoría duerme y una minoría nunca olvida.",
  },
  "mi-amo": {
    tagline: "Hay amos que nunca ordenan. Solo esperan que tú lo hagas por ellos.",
    synopsis: "Una relación de poder examinada desde adentro: quién sirve, quién manda y si es posible distinguir uno del otro cuando la dinámica lleva suficiente tiempo instalada. Tres minutos que incomodan con precisión quirúrgica.",
  },
  "microsuenos": {
    tagline: "Los sueños más intensos duran segundos. Estos tampoco.",
    synopsis: "Una colección de micro-relatos oníricos que caben en un minuto y dejan la sensación de haber dormido horas. Fragmentos de inconsciente animado que dicen más en su brevedad que cualquier narración extensa.",
  },
  "no-debimos-jugar": {
    tagline: "Empezó como un juego. Las reglas desaparecieron antes que la oscuridad.",
    synopsis: "Un juego que comenzó inocentemente se convierte en algo que ninguno de los participantes sabe cómo detener. Había reglas al principio. Luego solo quedó el impulso de seguir jugando aunque nadie recuerde por qué.",
  },
  "no-voy-a-decir-que-no-merezco-esto": {
    tagline: "A veces el castigo llega. Y lo reconoces antes de merecerlo.",
    synopsis: "Un personaje acepta su suerte con una resignación que tiene algo de cómica y mucho de oscura. En su aceptación silenciosa se revela todo lo que decide soportar — y la pregunta de si realmente lo merece o solo lo cree.",
  },
  "ojos": {
    tagline: "Miras porque puedes. Te miran porque no puedes evitarlo.",
    synopsis: "Los ojos ven — pero en este corto también son vistos. Una exploración de la mirada como espejo, como arma y como la única verdad que no podemos editar. Veintiocho segundos que no se olvidan fácilmente.",
  },
  "opium": {
    tagline: "Hay cosas que solo se ven con los ojos cerrados.",
    synopsis: "Una inmersión visual en los estados alterados que produce el opio — real, imaginario o metafórico. Un corto que explora el territorio de la percepción donde los límites entre lo que es y lo que se desea se disuelven.",
  },
  "papa": {
    tagline: "No hay que decir nada raro para dejar una cicatriz. A veces basta con no decir nada.",
    synopsis: "Una hija. Un padre. La distancia incómoda entre lo que uno quiso dar y lo que el otro aprendió a no pedir. Un corto sobre el silencio afectivo y lo que crece en él cuando nadie decide romperlo a tiempo.",
  },
  "pequenos-problemas": {
    tagline: "Dos demonios. Una vida. Una espiral de la que nadie regresa igual.",
    synopsis: "Dos demonios atormentan a un joven en su rutina cotidiana, conduciéndolo hacia una espiral descendente sin retorno. Un corto que trata los problemas mentales con la honestidad incómoda de quien los conoce desde adentro.",
  },
  "protestas-una-historia": {
    tagline: "Antes del grito, hay una historia. Esta es esa historia.",
    synopsis: "Cuando las calles se llenan de voces, cada protesta tiene un origen personal que las cámaras no capturan. Este corto cuenta una de esas historias — la que explica por qué alguien decide que callar ya no es una opción.",
  },
  "puerta": {
    tagline: "Entre ellos hay amor. Entre ellos hay una puerta. Eso lo complica todo.",
    synopsis: "Son novios, pero cada vez que uno entra el otro sale, y en ese cruce continuo algo se pierde o se gana sin que ninguno sepa exactamente qué. Un corto sobre las relaciones que viven en el umbral y nunca terminan de cruzarlo.",
  },
  "que-es-un-heroe": {
    tagline: "Siete minutos para una respuesta que te perseguirá el resto del día.",
    synopsis: "Una pregunta que parece simple y una respuesta que tarda siete minutos en construirse. A través de distintas voces y formas, el corto desmonta la idea del héroe hasta sus componentes más básicos — y lo que queda es perturbador.",
  },
  "quizas-la-flor-quizas-la-muerte-quizas": {
    tagline: "Quizás la flor. Quizás la muerte. Quizás solo importa el quizás.",
    synopsis: "Entre la flor y la muerte hay un quizás. Entre el amor y la pérdida hay otro. Un poema visual que habita la incertidumbre como si fuera su hogar natural, con animación de Dulce Zavala que convierte lo indeciso en algo hermoso.",
  },
  "ratametraje": {
    tagline: "Dos ratoncitos inocentes. Un festín lejano. El trazo es amable — la historia, no.",
    synopsis: "A ritmo de música, dos ratoncitos intentan colarse en la mesa de alguien. Lo que empieza como una aventura tierna pronto revela que ni el trazo más dulce puede ocultar lo que hay debajo de la superficie.",
  },
  "rojo-y-negro-sobre-blanco": {
    tagline: "Dos colores. Un lienzo. Todo lo que necesitas para decirlo todo.",
    synopsis: "Rojo y negro sobre blanco construyen un lenguaje visual que trasciende la representación para convertirse en emoción pura. Un corto que demuestra que la paleta más reducida puede contener el mayor universo.",
  },
  "sangre-de-hermanos": {
    tagline: "Los hermanos comparten sangre. No siempre comparten camino.",
    synopsis: "Dos hermanos con la misma sangre recorren rutas que se separan hasta que algo — inevitable, violento, necesario — los hace chocar de frente. Un corto sobre los vínculos que no elegimos y las consecuencias que sí.",
  },
  "shefish": {
    tagline: "El río Magdalena guarda leyendas. La bocachica las guarda a ella.",
    synopsis: "En el caudaloso Magdalena, las leyendas viajan de boca en boca. She Fish cuenta la historia de un pescador que se enfrenta a la bocachica — una depredadora por naturaleza que conoce el río mejor que cualquier habitante de sus orillas.",
  },
  "si": {
    tagline: "Cinco segundos. Una palabra. Ya no hay vuelta atrás.",
    synopsis: "El corto más corto de la colección: cinco segundos para pronunciar la sílaba que lo cambia todo. Una obra minimalista que demuestra que el tiempo no determina el impacto.",
  },
  "siul-a-fun-fan-animation": {
    tagline: "El manga que pocas veces se anima. Esta es una de esas veces.",
    synopsis: "Una adaptación animada de fan del manga Siul a Fun que da movimiento y vida a páginas que la mayoría solo leyó. Un homenaje que se sostiene como pieza propia.",
  },
  "sleep-patters": {
    tagline: "Una canción de Merchant Ships. Una animación que la convierte en imagen. Y la imagen en algo más.",
    synopsis: "Un videoclip animado que toma literalmente una canción de Merchant Ships y construye desde ella un mundo visual coherente y melancólico. Tres minutos donde la música y la imagen no se acompañan — se funden.",
  },
  "smile-shine-2": {
    tagline: "Brilla más que el primero. Promete más de lo que el primero cumplió.",
    synopsis: "Segunda entrega que amplía el universo visual de su predecesora con más brillo y más oscuridad en partes iguales. Una sonrisa que ya no sabemos si es de bienvenida o de advertencia.",
  },
  "solio": {
    tagline: "El trono está vacío. El poder, no.",
    synopsis: "Un trono que nadie ocupa y un poder que nadie reclama en voz alta. Cuatro minutos que exploran la autoridad vacía, lo que crece cuando nadie está mirando y la diferencia entre el símbolo y lo que representa.",
  },
  "solo-divirtiendose-en-un-agotador-trabajo": {
    tagline: "Las bolas de papel siempre llegan de algún lado. La pregunta es cuándo paras de tirar.",
    synopsis: "Un trabajador descubre que su papelera ya tiene demasiadas bolas de papel y cede a la distracción de encestablar la del cubículo vecino. Lo que parece un momento de alivio revela ser un loop infinito del que nadie quiere salir.",
  },
  "space-diamond": {
    tagline: "En el espacio todo vale infinito y nada tiene dueño. Aún.",
    synopsis: "Un diamante flota entre estrellas en el espacio exterior — símbolo de valor absoluto en un entorno donde el valor no existe. Una aventura visual de tres minutos sobre la rareza, la belleza y las cosas que nadie puede reclamar.",
  },
  "space-tourism": {
    tagline: "Bienvenido al espacio. Sin wifi, sin servicio de habitaciones y algo quiere comerte.",
    synopsis: "El turismo espacial prometía ser el lujo definitivo del siglo XXI. Para un astronauta hambriento con un bot leal, resulta ser principalmente un problema de logística y depredadores. Una comedia de aventuras cósmica en un minuto.",
  },
  "terminado-el-dia": {
    tagline: "El día terminó. Lo que no terminó es la pregunta que deja.",
    synopsis: "Al final de la jornada, cuando el ruido cesa, quedan las preguntas que el movimiento constante no dejaba escuchar. Un minuto que examina qué queda de un día cuando por fin se acaba.",
  },
  "the-match": {
    tagline: "No es el partido lo que importa. Es lo que se juega en él.",
    synopsis: "Un partido que va mucho más allá del marcador — es el escenario donde se dirimen el orgullo, la identidad y la pertenencia. Todo lo que no puede medirse en goles se juega aquí con la misma intensidad.",
  },
  "todavia-esperamos": {
    tagline: "Un minuto. La historia entera de la humanidad. Todavía no terminamos.",
    synopsis: "Al ritmo del reloj, un repaso acelerado de todo lo que la humanidad ha construido, destruido y vuelto a construir. El título no miente: después de todo lo visto, todavía esperamos que algo cambie.",
  },
  "trajecte-ultim": {
    tagline: "Último trayecto. Todo lo que importa cabe en él.",
    synopsis: "El viaje final de un personaje que lo ha visto todo — desde el primer hasta el último tren, desde el principio hasta el acabamiento. Una historia sobre lo que decidimos llevar cuando ya no hay más destinos.",
  },
  "una-ciudad-de-mierda-con-un-gato": {
    tagline: "La ciudad es una mierda. El gato, no. Eso cambia todo.",
    synopsis: "Una ciudad hostil, gris y cansada tiene un habitante que no se entera de nada: un gato. El contraste entre la miseria del entorno y la indiferencia absoluta del felino es suficiente para verlo todo de otra manera.",
  },
  "ventisca-negra": {
    tagline: "Una tormenta, dos manos y solo una puede salir libre.",
    synopsis: "Un pianista detenido por homicidio y un estafador de cartas huyen juntos cuando el tren choca. Atrapados en una ventisca, deben tomar la decisión más brutal: a cuál de los dos hay que cortar la mano para que el otro escape.",
  },
  "wave-core": {
    tagline: "Nueve segundos. Una ola. Todo el universo que necesitas.",
    synopsis: "La animación más breve de la colección: nueve segundos que contienen una ola, su núcleo y la energía que los conecta. Una demostración de que lo esencial no necesita más tiempo del que necesita para existir.",
  },
  "yasha-gozen": {
    tagline: "Una guerrera del manga de Ryouko Yamagishi, animada por primera vez.",
    synopsis: "Basado en el trabajo de Ryouko Yamagishi, miembro del legendario grupo del 24, este corto da movimiento y voz a Yasha Gozen en una animación que honra la fuente con su propia identidad visual.",
  },
  "ylli": {
    tagline: "El anima no descansa. Te arrastra hacia la vida aunque el cuerpo prefiera quedarse quieto.",
    synopsis: "La discusión con el anima — esa ambigüedad más personal que arrastra al cuerpo inerte con astucia y engaño — se convierte en el eje de un cortometraje de seis minutos sobre el proceso de individuación de Jung hecho imagen.",
  },
};
