(request, toast) => {

    function initialise() {
        setInterval(run, 1000 * 60 * 5);
        run();
    }

    async function run() {
        const version = await request.getVersion();
        if(!window.RIFTSCRIPT_VERSION || version === window.RIFTSCRIPT_VERSION) {
            return;
        }
        toast.create({
            text: `<a href='https://rift-guild.com/scripts' target='_blank'>Consider updating RiftScript to ${version}!<br>Click here to update</a`,
            image: 'https://img.icons8.com/?size=48&id=iAqIpjeFjcYz&format=png',
            time: 5000
        });
    }

    initialise();

}
