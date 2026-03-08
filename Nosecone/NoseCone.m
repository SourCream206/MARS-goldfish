function [Drag] = NoseCone(R,L,x,type,k,rho,Re,V)

    if type == 1
        % Elliptical
        r_ellip = R .* sqrt(1 - ((x - L).^2 ./ L^2));
        r_ellip = max(r_ellip, 1e-5);
        drdx_ellip = gradient(r_ellip,x);
        dA_ellip = 2*pi*r_ellip.*sqrt(1+ drdx_ellip.^2) * (x(2)-x(1));
        
        curve = (gradient(drdx_ellip,x)).^2.*dA_ellip;
        Cf = 0.074./Re.^(0.2);
        
        q = 0.5*rho*V^2;
        V_local = V ./ sqrt(1 + drdx_ellip.^2);  
        Cp = 1 - (V_local ./ V).^2;
        costheta = 1 ./ sqrt(1 + drdx_ellip.^2);
        D_pressure = sum(Cp.*costheta * q .* dA_ellip);

        Drag  = sum(q*Cf.*dA_ellip) + D_pressure + 0.1*sum(curve);

    elseif type == 2 
        % Ogive
        r_ogive = sqrt(((R^2 + L^2)/(2*R))^2 - (L - x).^2) + R - ((R^2 + L^2)/(2*R));
        r_ogive = max(r_ogive, 1e-5);
        drdx_ogive = gradient(r_ogive, x);

        
        dA_ogive = 2*pi*r_ogive.*sqrt(1 + drdx_ogive.^2)* (x(2)-x(1));
        
        curve = (gradient(drdx_ogive,x)).^2.*dA_ogive;
        Cf = 0.074./Re.^(0.2);
        
        q = 0.5*rho*V^2;
        V_local = V ./ sqrt(1 + drdx_ogive.^2);  
        Cp = 1 - (V_local ./ V).^2;
        costheta = 1 ./ sqrt(1 + drdx_ogive.^2);
        D_pressure = sum(Cp.*costheta * q .* dA_ogive);

        Drag  = sum(q*Cf.*dA_ogive) + D_pressure+0.1*sum(curve);

    elseif type == 3
        % Parabolic
        r_para = R .* (x ./ L).^k;
        r_para = max(r_para, 1e-5);
        drdx_para = gradient(r_para, x);

        dA_para = 2*pi*r_para.*sqrt(1 + drdx_para.^2)* (x(2)-x(1));
        
        curve = (gradient(drdx_para,x)).^2.*dA_para;
        Cf = 0.074./Re.^(0.2);

        q = 0.5*rho*V^2;
        V_local = V ./ sqrt(1 + drdx_para.^2);  
        Cp = 1 - (V_local ./ V).^2;
        costheta = 1 ./ sqrt(1 + drdx_para.^2);
        D_pressure = sum(Cp.*costheta * q .* dA_para);

        Drag  = sum(q*Cf.*dA_para) + D_pressure + 0.1*sum(curve);


    else
        % Haack 
        theta = acos(1 - 2*x/L);
        
        r_haack = R * sqrt((theta - sin(2*theta)/2)/pi);
        r_haack = max(r_haack, 1e-5);
        drdx_haack = gradient(r_haack, x);
        dA_haack = 2*pi*r_haack.*sqrt(1 + drdx_haack.^2)* (x(2)-x(1));
        
        
        curve = (gradient(drdx_haack,x)).^2.*dA_haack;
        %skin firction based of turbulent flow
        Cf = 0.074./Re.^(0.2);
        
        q = 0.5*rho*V^2;
        V_local = V ./ sqrt(1 + drdx_haack.^2);  
        Cp = 1 - (V_local ./ V).^2;
        costheta = 1 ./ sqrt(1 + drdx_haack.^2);
        D_pressure = sum(Cp.*costheta * q .* dA_haack);

        Drag  = sum(q*Cf.*dA_haack) +  D_pressure+0.1*sum(curve);

    end 

end