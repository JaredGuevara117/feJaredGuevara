self.addEventListener('isntall',event=>{
    caches.open("appShell_v1.0")
    .then(cache=>{
        cache.addAll([
            "/src/index.css",
            "/src/App.jsx",
            "/src/App.css",
        ]);
    })
    self.skipWaiting();
});
self.addEventListener('activate',event=>{
    caches.delete("appShell");
    caches.delete("dynamic");
});
self.addEventListener('fetch',event=>{
    if(event.request.method==="GET"){
        const resp=fetch(event.request)
        .then(respuesta=>{ 
            caches.match(event.request)
            .then(cache=>{
                if(cache===undefined){
                    caches.open("dynamic_v1.0")
                    .then(cacheDyn=>{
                        cacheDyn.put(event.request,respuesta);
                    })
                }
            });
            return respuesta.clone();
            console.log("respuesta",respuesta);
    }).catch(error=>{
        return caches.match(event.request)
    });
}
});
/* self.addEventListener('sync',event=>{});
self.addEventListener('push',event=>{}); */